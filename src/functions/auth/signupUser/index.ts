import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import middy from "@middy/core";
import jsonBodyParser from "@middy/http-json-body-parser";
import validator from "@middy/validator";
import { transpileSchema } from "@middy/validator/transpile";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { TransactWriteItemsCommand } from "@aws-sdk/client-dynamodb";
import { SignJWT } from "jose";

import { newUserSchema } from "../../../schemas/newUserSchema";
import { client } from "../../../services/db";
import { sendResponse } from "../../../utils/sendResponse";

//TYPES
type NewUserBody = {
  username: string;
  email: string;
  password: string;
};

const TABLE = process.env.QUIZ_TABLE;
const JWT_SECRET = process.env.JWT_SECRET! ?? "";

const lamdbaHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  const body = event.body as unknown as NewUserBody;

  const usernameNorm = body.username.trim().toLowerCase();
  const emailNorm = body.email.trim().toLowerCase();

  const userId = uuidv4();
  const now = new Date().toISOString();

  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(body.password, salt);

  try {
    await client.send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Put: {
              TableName: TABLE,
              Item: {
                pk: { S: `USER#${userId}` },
                sk: { S: "META" },
                userId: { S: userId },
                username: { S: body.username },
                email: { S: body.email },
                password: { S: hash },
                createdAt: { S: now },
                modifiedAt: { S: now },
              },
              ConditionExpression:
                "attribute_not_exists(pk) AND attribute_not_exists(sk)",
            },
          },
          {
            Put: {
              TableName: TABLE,
              Item: {
                pk: { S: `UNI#USERNAME#${usernameNorm}` },
                sk: { S: "META" },
                userId: { S: userId },
              },
              ConditionExpression: "attribute_not_exists(pk)",
            },
          },
          {
            Put: {
              TableName: TABLE,
              Item: {
                pk: { S: `UNI#EMAIL#${emailNorm}` },
                sk: { S: "META" },
                userId: { S: userId },
              },
              ConditionExpression: "attribute_not_exists(pk)",
            },
          },
        ],
      })
    );
  } catch (err: any) {
    if (err?.name === "TransactionCanceledException") {
      const reasons: Array<{ Code?: string }> = err.CancellationReasons ?? [];

      const usernameTaken = reasons[1]?.Code === "ConditionalCheckFailed";
      const emailTaken = reasons[2]?.Code === "ConditionalCheckFailed";

      if (usernameTaken || emailTaken) {
        return sendResponse(409, {
          success: false,
          error: "CONFLICT",
          message: usernameTaken
            ? "Username is already taken"
            : "Email is already taken",
        });
      }

      return sendResponse(409, {
        success: false,
        error: "TRANSACTION_CONFLICT",
      });
    }

    return sendResponse(500, {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: err?.message ?? "Unknown error",
    });
  }

  const secret = new TextEncoder().encode(JWT_SECRET);
  const token = await new SignJWT({
    username: usernameNorm,
    email: emailNorm,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("3h")
    .sign(secret);

  return sendResponse(201, {
    success: true,
    message: "User signup successfull",
    token,
    user: {
      userId: userId,
      username: body.username,
      email: body.email,
      createdAt: now,
    },
  });
};

export const handler = middy<
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2
>(lamdbaHandler)
  .use(jsonBodyParser())
  .use(validator({ eventSchema: transpileSchema(newUserSchema) }));

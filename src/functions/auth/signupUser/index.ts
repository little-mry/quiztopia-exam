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

import { client } from "../../../services/db";
import { sendResponse } from "../../../utils/sendResponse";
import { errorHandler } from "../../../middlewares/errorHandler";
import { ConflictError, InternalServerError } from "../../../utils/httpErrors";
import { newUserSchema } from "../../../schemas/userSchemas";
import type { NewUserBody } from "../../../types/userTypes";

const TABLE = process.env.QUIZ_TABLE;
const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) throw new InternalServerError("Server misconfigured");

const lamdbaHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  const body = event.body as unknown as NewUserBody;

  //trim and make username and email to lowecase- to later compare to db (uniqeness)
  const usernameNorm = body.username.trim().toLowerCase();
  const emailNorm = body.email.trim().toLowerCase();

  //create userId and "now"(for key createdAt)
  const userId = uuidv4();
  const now = new Date().toISOString();

  //crypt password
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(body.password, salt);

  try {
    //try create user - 3 rows: USER#<userId> (actual user) + UNI#USERNAME#<username> + UNI#EMAIL#<email>
    // check that pk, sk, email and username are unique
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

      if (usernameTaken) {
        throw new ConflictError("Username is already taken");
      }
      if (emailTaken) {
        throw new ConflictError("Email is already taken");
      }

      throw new ConflictError("Transaction conflict");
    }

    throw new InternalServerError();
  }

  // create token w jose
  // LATER : put in cookie
  const token = await new SignJWT({
    username: usernameNorm,
    userId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("3h")
    .sign(new TextEncoder().encode(JWT_SECRET));

  return sendResponse(201, {
    success: true,
    message: "Signup successful",
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
  .use(validator({ eventSchema: transpileSchema(newUserSchema) }))
  .use(errorHandler());

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import middy from "@middy/core";
import jsonBodyParser from "@middy/http-json-body-parser";
import validator from "@middy/validator";
import { transpileSchema } from "@middy/validator/transpile";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { GetItemCommand } from "@aws-sdk/client-dynamodb";

import { client } from "../../../services/db";
import { sendResponse } from "../../../utils/sendResponse";
import { errorHandler } from "../../../middlewares/errorHandler";
import {
  InternalServerError,
  UnauthorizedError,
} from "../../../utils/httpErrors";

import type { LoginUserBody } from "../../../types/userTypes";
import { loginUserSchema } from "../../../schemas/userSchemas";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const TABLE = process.env.QUIZ_TABLE;
const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) throw new InternalServerError("Server misconfigured");

const lamdbaHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  const body = event.body as unknown as LoginUserBody;

  const usernameNorm = body.username.trim().toLowerCase();

  try {
    const resUser = await client.send(
      new GetItemCommand({
        TableName: TABLE,
        Key: {
          pk: { S: `UNI#USERNAME#${usernameNorm}` },
          sk: { S: "META" },
        },
        ConsistentRead: true,
        ProjectionExpression: "userId"
      })
    );

    if (!resUser.Item) {
      throw new UnauthorizedError("Invalid credentials");
    }
    const item = unmarshall(resUser.Item);
    const userId = item.userId as string;

    const resLogin = await client.send(
      new GetItemCommand({
        TableName: TABLE,
        Key: {
          pk: { S: `USER#${userId}` },
          sk: { S: "META" },
        },
        ConsistentRead: true,
        ProjectionExpression: "password, username, email, userId"
      })
    );

    if (!resLogin.Item) throw new InternalServerError();
    const loginItem = unmarshall(resLogin.Item);
    const ok = await bcrypt.compare(body.password, loginItem.password);
    if (!ok) throw new UnauthorizedError("Invalid credentials");

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

    return sendResponse(200, {
      success: true,
      message: "Login successful",
      token,
      user: {
        userId,
        username: loginItem.username,
        email: loginItem.email,
      },
    });
  } catch (err) {
    console.error("loginUser error:", err);
    throw err;
  }
};

export const handler = middy<
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2
>(lamdbaHandler)
  .use(jsonBodyParser())
  .use(validator({ eventSchema: transpileSchema(loginUserSchema) }))
  .use(errorHandler());

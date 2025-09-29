import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { HttpEventWithAuthAndBody } from "../../types/httpEvent";
import middy from "@middy/core";
import jsonBodyParser from "@middy/http-json-body-parser";
import validator from "@middy/validator";
import { transpileSchema } from "@middy/validator/transpile";
import { v4 as uuidv4 } from "uuid";

import { client } from "../../services/db";
import { sendResponse } from "../../utils/sendResponse";
import { errorHandler } from "../../middlewares/errorHandler";
import { ConflictError, InternalServerError } from "../../utils/httpErrors";
import { newQuizSchema } from "../../schemas/quizSchemas";
import type { NewQuizBody } from "../../types/quizTypes";
import { authorize } from "../../middlewares/authMiddleware";
import { PutItemCommand } from "@aws-sdk/client-dynamodb";

const TABLE = process.env.QUIZ_TABLE!;

const lamdbaHandler = async (
  event: HttpEventWithAuthAndBody<NewQuizBody>
): Promise<APIGatewayProxyStructuredResultV2> => {
  const body = event.body;
  const userId = event.auth!.userId;

  const quizName = body.quizname.trim();
  const quizCity = body.city.trim();
  const quizId = uuidv4();
  const now = new Date().toISOString();

  try {
    await client.send(
      new PutItemCommand({
        TableName: TABLE,
        Item: {
          pk: { S: `QUIZ#${quizId}` },
          sk: { S: "META" },
          quizId: { S: quizId },
          ownerId: { S: userId },
          quizName: { S: quizName },
          city: { S: quizCity },
          createdAt: { S: now },
          modifiedAt: { S: now },
        },
        ConditionExpression:
          "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      })
    );
  } catch (err: any) {
    if (err?.name === "ConditionalCheckFailedException") {
      throw new ConflictError("Conflict");
    }
    throw new InternalServerError();
  }

  return sendResponse(201, {
    success: true,
    message: "Quiz created",
    quiz: {
      quizId,
      quizName: quizName,
      quizCity: quizCity,
      ownerId: userId,
      createdAt: now,
    },
  });
};

export const handler = middy(lamdbaHandler)
  .use(authorize())
  .use(jsonBodyParser())
  .use(validator({ eventSchema: transpileSchema(newQuizSchema) }))
  .use(errorHandler());

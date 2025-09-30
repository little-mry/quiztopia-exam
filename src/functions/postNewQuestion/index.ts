import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { HttpEventWithAuthAndBody } from "../../types/httpEvent";
import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import middy from "@middy/core";
import jsonBodyParser from "@middy/http-json-body-parser";
import validator from "@middy/validator";
import { transpileSchema } from "@middy/validator/transpile";

import { client } from "../../services/db";
import { sendResponse } from "../../utils/sendResponse";
import { errorHandler } from "../../middlewares/errorHandler";
import { authorize } from "../../middlewares/authMiddleware";
import { ConflictError, InternalServerError } from "../../utils/httpErrors";

import { assertQuizOwnership } from "../../services/quizRepo";
import type { NewQuestionBody } from "../../types/quizTypes";
import { newQuestionSchema } from "../../schemas/quizSchemas";

const TABLE = process.env.QUIZ_TABLE!;

const lamdbaHandler = async (
  event: HttpEventWithAuthAndBody<NewQuestionBody>
): Promise<APIGatewayProxyStructuredResultV2> => {
  const body = event.body;
  const { quizId } = event.pathParameters as { quizId: string };
  const userId = event.auth!.userId;

  const question = body.question.trim();
  const answer = body.answer.trim();
  const longitude = body.location.longitude;
  const latitude = body.location.latitude;
  const questionId = Date.now();
  const now = new Date().toISOString();

  await assertQuizOwnership(quizId, userId);

  try {
    await client.send(
      new PutItemCommand({
        TableName: TABLE,
        Item: {
          pk: { S: `QUIZ#${quizId}` },
          sk: { S: `Q#${questionId}` },
          question: { S: question },
          answer: { S: answer },
          location: {
            M: {
              longitude: { N: longitude.toString() },
              latitude: { N: latitude.toString() },
            },
          },
          questionId: { N: questionId.toString() },
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
    message: `Question added to quiz ${quizId}`,
    question: {
      question,
      answer,
      location: {
        longitude: longitude,
        latitude: latitude,
      },
      questionId,
      createdAt: now,
    },
  });
};

export const handler = middy(lamdbaHandler)
  .use(authorize())
  .use(jsonBodyParser())
  .use(validator({ eventSchema: transpileSchema(newQuestionSchema) }))
  .use(errorHandler());

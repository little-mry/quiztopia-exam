import type {
  APIGatewayProxyStructuredResultV2,
  APIGatewayProxyEventV2,
} from "aws-lambda";
import middy from "@middy/core";
import validator from "@middy/validator";

import { client } from "../../services/db";
import { sendResponse } from "../../utils/sendResponse";
import { errorHandler } from "../../middlewares/errorHandler";
import { authorize } from "../../middlewares/authMiddleware";
import { InternalServerError, NotFoundError } from "../../utils/httpErrors";
import { QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { transpileSchema } from "@middy/validator/transpile";
import { getQuizSchema } from "../../schemas/quizSchemas";

const TABLE = process.env.QUIZ_TABLE!;

const lamdbaHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  const { quizId } = event.pathParameters as { quizId: string };

  try {
    const cmd = new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "#pk = :pk",
      ExpressionAttributeNames: {
        "#pk": "pk",
      },
      ExpressionAttributeValues: {
        ":pk": { S: `QUIZ#${quizId}` },
      },
      ConsistentRead: true,
    });

    const { Items = [] } = await client.send(cmd);
    if (Items.length === 0) {
      throw new NotFoundError(`Couldn't find quiz with id ${quizId}`);
    }
    const rows = Items.map((it) => unmarshall(it));

    const meta = rows.find((r) => r.sk === "META");
    if (!meta) {
      throw new InternalServerError("Malformed quiz: missing META item");
    }
    const questions = rows
      .filter((r) => typeof r.sk === "string" && r.sk.startsWith("Q#"))
      .map((r) => ({
        questionId: r.questionId ?? r.sk.replace("Q#", ""),
        question: r.question,
        answer: r.answer,
        location: r.location,
      }));

    const quiz = {
      quizId: meta.quizId,
      quizName: meta.quizName,
      city: meta.city,
      questions,
      createdAt: meta.createdAt,
      ownerId: meta.ownerId,
    };
    return sendResponse(200, { success: true, quiz });
  } catch (error) {
    throw error;
  }
};

export const handler = middy(lamdbaHandler)
  .use(authorize())
  .use(validator({ eventSchema: transpileSchema(getQuizSchema) }))
  .use(errorHandler());

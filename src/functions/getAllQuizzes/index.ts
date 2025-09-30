import type {
  APIGatewayProxyStructuredResultV2,
  APIGatewayProxyEventV2,
} from "aws-lambda";
import middy from "@middy/core";

import { client } from "../../services/db";
import { sendResponse } from "../../utils/sendResponse";
import { errorHandler } from "../../middlewares/errorHandler";
import { authorize } from "../../middlewares/authMiddleware";
import { InternalServerError, NotFoundError } from "../../utils/httpErrors";
import { QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const TABLE = process.env.QUIZ_TABLE!;

const lamdbaHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const cmd = new QueryCommand({
      TableName: TABLE,
      IndexName: "GSI_ALL_QUIZZES",
      KeyConditionExpression: "#pk = :pk",
      ExpressionAttributeNames: { "#pk": "GSI_ALL_pk" },
      ExpressionAttributeValues: {
        ":pk": { S: "QUIZ" },
      },
      ScanIndexForward: false,
    });

    const { Items = [] } = await client.send(cmd);
    if (Items.length === 0) {
      throw new NotFoundError("No quizzes found");
    }

    const quizzes = Items.map((item) => {
      const data = unmarshall(item);

      return {
        quizName: data.quizName,
        quizId: data.quizId,
        city: data.city,
        createdAt: data.createdAt,
        modifiedAt: data.modifiedAt,
        ownerId: data.ownerId,
      };
    });

    return sendResponse(200, { success: true, quizzes });
  } catch (error) {
    console.error("getAllQuizzes error:", error);
    throw error;
  }
};

export const handler = middy(lamdbaHandler)
  .use(authorize())
  .use(errorHandler());

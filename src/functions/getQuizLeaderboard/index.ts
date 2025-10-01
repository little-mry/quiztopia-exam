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
      IndexName: "GSI_LEADERBOARD",
      KeyConditionExpression: "#pk = :pk",
      ExpressionAttributeNames: { "#pk": "GSI_LEAD_pk" },
      ExpressionAttributeValues: {
        ":pk": { S: `QUIZ#${quizId}` },
      },
      ScanIndexForward: false,
    });

    const { Items = [] } = await client.send(cmd);
    if (Items.length === 0) {
      throw new NotFoundError("No leaderboard scores found");
    }

    const first = unmarshall(Items[0]);
    const quiz = {
      quizId: first.quizId,
      quizName: first.quizName,
    };
    const leaderboard = Items.map((item) => {
      const data = unmarshall(item);
      return {
        userId: data.userId,
        score: data.score,
        createdAt: data.createdAt,
        modifiedAt: data.modifiedAt,
      };
    });

    return sendResponse(200, { success: true, quiz, leaderboard });
  } catch (error) {
    console.error("getQuizLeaderboard error:", error);
    throw new InternalServerError("Failed to fetch leaderboard");
  }
};

export const handler = middy(lamdbaHandler)
  .use(authorize())
  .use(validator({ eventSchema: transpileSchema(getQuizSchema) }))
  .use(errorHandler());

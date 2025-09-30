import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { HttpEventWithAuth } from "../../types/httpEvent";
import middy from "@middy/core";
import validator from "@middy/validator";

import { client } from "../../services/db";
import { sendResponse } from "../../utils/sendResponse";
import { errorHandler } from "../../middlewares/errorHandler";
import { authorize } from "../../middlewares/authMiddleware";
import { InternalServerError, NotFoundError } from "../../utils/httpErrors";
import { QueryCommand, BatchWriteItemCommand } from "@aws-sdk/client-dynamodb";
import { transpileSchema } from "@middy/validator/transpile";
import { getQuizSchema } from "../../schemas/quizSchemas";
import { assertQuizOwnership } from "../../services/quizRepo";

const TABLE = process.env.QUIZ_TABLE!;

const lamdbaHandler = async (
  event: HttpEventWithAuth
): Promise<APIGatewayProxyStructuredResultV2> => {
  const { quizId } = event.pathParameters as { quizId: string };
  const userId = event.auth!.userId;

  await assertQuizOwnership(quizId, userId);

  try {
    const { Items } = await client.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "#pk = :pk",
        ExpressionAttributeNames: { "#pk": "pk" },
        ExpressionAttributeValues: { ":pk": { S: `QUIZ#${quizId}` } },
      })
    );

    if (!Items || Items.length === 0) {
      throw new NotFoundError("Quiz not found");
    }

    for (let i = 0; i < Items.length; i += 25) {
      const chunk = Items.slice(i, i + 25);
      const RequestItems = {
        [TABLE]: chunk.map((it) => ({
          DeleteRequest: {
            Key: {
              pk: it.pk, 
              sk: it.sk, 
            },
          },
        })),
      };

      await client.send(new BatchWriteItemCommand({ RequestItems }));
    }

    return sendResponse(200, {
      success: true,
      msg: "Quiz deleted",
      quizId: quizId,
    });
  } catch (error: any) {
    if (error?.statusCode) throw error;
    throw new InternalServerError();
  }
};

export const handler = middy(lamdbaHandler)
  .use(authorize())
  .use(validator({ eventSchema: transpileSchema(getQuizSchema) }))
  .use(errorHandler());

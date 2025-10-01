import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { HttpEventWithAuthAndBody } from "../../types/httpEvent";
import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import middy from "@middy/core";
import jsonBodyParser from "@middy/http-json-body-parser";
import validator from "@middy/validator";
import { transpileSchema } from "@middy/validator/transpile";

import { client } from "../../services/db";
import { sendResponse } from "../../utils/sendResponse";
import { errorHandler } from "../../middlewares/errorHandler";
import { authorize } from "../../middlewares/authMiddleware";
import { ConflictError, InternalServerError } from "../../utils/httpErrors";
import { leaderboardSchema } from "../../schemas/leaderboardSchemas";
import type { ScoreBody } from "../../types/leaderboardTypes";
import { fetchQuiz } from "../../services/quizRepo";

const TABLE = process.env.QUIZ_TABLE!;
const padScore = (n: number, width = 10) => n.toString().padStart(width, "0");

const lamdbaHandler = async (
  event: HttpEventWithAuthAndBody<ScoreBody>
): Promise<APIGatewayProxyStructuredResultV2> => {
  const score = event.body.score;
  const { quizId } = event.pathParameters as { quizId: string };
  const userId = event.auth!.userId;

  const {quizName} = await fetchQuiz<{quizName: string}>(
    { pk: `QUIZ#${quizId}`, sk: "META" },
    "quizName"
  );

  const now = new Date().toISOString();
  const padded = padScore(score);
  try {
    await client.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: {
          pk: { S: `QUIZ#${quizId}` },
          sk: { S: `LEADER#USER#${userId}` },
        },
        ConditionExpression: "attribute_not_exists(score) OR :newScore > score",
        UpdateExpression: [
          "SET quizId = :quizId",
          "quizName = :quizName",
          "userId = :userId",
          "score = :newScore",
          "GSI_LEAD_pk = :leadPk",
          "GSI_LEAD_sk = :leadSk",
          "createdAt = if_not_exists(createdAt, :now)",
          "modifiedAt = :now"
        ].join(", "),
        ExpressionAttributeValues: {
          ":quizId": { S: quizId },
          ":quizName": { S: quizName },
          ":userId": { S: userId },
          ":newScore": { N: score.toString() },
          ":leadPk": { S: `QUIZ#${quizId}` },
          ":leadSk": { S: `SCORE#${padded}#${userId}` },
          ":now": { S: now },
        },
        ReturnValues: "NONE",
      })
    );
  } catch (err: any) {
    if (err?.name === "ConditionalCheckFailedException") {
      throw new ConflictError(
        "The new score is not higher than your current score."
      );
    }
    console.error("DDB error", err)
    throw new InternalServerError();
  }
  return sendResponse(201, {
    success: true,
    message: `Score added to quiz ${quizId}`,
    quizName,
    user: userId,
    score,
  });
};

export const handler = middy(lamdbaHandler)
  .use(authorize())
  .use(jsonBodyParser())
  .use(validator({ eventSchema: transpileSchema(leaderboardSchema) }))
  .use(errorHandler());

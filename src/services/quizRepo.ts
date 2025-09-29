import { GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { client } from "../services/db";
import { UnauthorizedError, NotFoundError } from "../utils/httpErrors";

const TABLE = process.env.QUIZ_TABLE!;

export type KeyInput = Record<string, string | number>;

//function to get item
export const getItemByKey = async <T>(
  key: KeyInput,
  projection?: string
): Promise<T | null> => {
  const cmd = new GetItemCommand({
    TableName: TABLE,
    Key: marshall(key),
    ...(projection ? { ProjectionExpression: projection } : {}),
  });

  const { Item } = await client.send(cmd);
  return Item ? (unmarshall(Item) as T) : null;
};

//helper to get quiz or throw notfound error
export const fetchQuiz = async <T extends { quizId?: string }>(
  key: KeyInput,
  projection?: string
): Promise<T> => {
  const quiz = await getItemByKey<T>(key, projection);
  if (!quiz) throw new NotFoundError("Quiz not found");
  return quiz;
};

//checks that the uer is the actual owner of the quiz
export const assertOwner = (
  quiz: Record<string, any>,
  userId: string,
  ownerField = "ownerId"
) => {
  if (!quiz || quiz[ownerField] !== userId) {
    throw new UnauthorizedError(
      "Unauthorized request- you can only update/delete your own quiz"
    );
  }
};

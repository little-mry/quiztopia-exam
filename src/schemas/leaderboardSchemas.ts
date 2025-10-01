export const leaderboardSchema = {
  type: "object",
  required: ["body", "pathParameters"],
  properties: {
    body: {
      type: "object",
      required: ["score"],
      properties: {
        score: { type: "number", minimum: 0},
      },
      additionalProperties: false,
    },
    pathParameters: {
      type: "object",
      required: ["quizId"],
      properties: {
        quizId: { type: "string", format: "uuid" },
      },
      additionalProperties: false,
    },
  },
};
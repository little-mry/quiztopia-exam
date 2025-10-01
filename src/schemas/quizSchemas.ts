export const newQuizSchema = {
  type: "object",
  required: ["body"],
  properties: {
    body: {
      type: "object",
      required: ["quizname", "city"],
      properties: {
        quizname: { type: "string", minLength: 3, maxLength: 30 },
        city: { type: "string", minLength: 3, maxLength: 50 },
      },
      additionalProperties: false,
    },
  },
};

export const newQuestionSchema = {
  type: "object",
  required: ["body", "pathParameters"],
  properties: {
    body: {
      type: "object",
      required: ["question", "answer", "location"],
      properties: {
        question: { type: "string", minLength: 3, maxLength: 100 },
        answer: { type: "string", minLength: 3, maxLength: 50 },
        location: {
          type: "object",
          required: ["longitude", "latitude"],
          properties: {
            longitude: { type: "number" },
            latitude: { type: "number" },
          },
          additionalProperties: false,
        },
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

export const getQuizSchema = {
  type: "object",
  required: ["pathParameters"],
  properties: {
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

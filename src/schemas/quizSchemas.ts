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

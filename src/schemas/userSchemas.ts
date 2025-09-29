export const newUserSchema = {
  type: "object",
  additionalProperties: true,
  required: ["body"],
  properties: {
    body: {
      type: "object",
      additionalProperties: false,
      required: ["username", "email", "password"],
      properties: {
        username: { type: "string", minLength: 1, maxLength: 30 },
        email: { type: "string", format: "email" },
        password: { type: "string", minLength: 6, maxLength: 50 },
      },
    },
  },
};

export const loginUserSchema = {
  type: "object",
  required: ["body"],
  properties: {
    body: {
      type: "object",
      required: ["username", "password"],
      properties: {
        username: { type: "string", minLength: 1, maxLength: 30 },
        password: { type: "string", minLength: 6, maxLength: 50 },
      },
      additionalProperties: false,
    },
  },
};

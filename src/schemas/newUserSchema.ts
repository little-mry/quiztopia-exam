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

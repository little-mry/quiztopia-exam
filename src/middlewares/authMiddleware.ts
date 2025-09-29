import type { MiddlewareObj, Request } from "@middy/core";
import { jwtVerify } from "jose";
import { UnauthorizedError } from "../utils/httpErrors";
import { sendResponse } from "../utils/sendResponse";

const JWT_SECRET = process.env.JWT_SECRET!;

export const authorize = (): MiddlewareObj => {
  const before = async (request: Request) => {
    const authHeader = request.event.headers?.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("Missing or invalid Authorization header");
    }

    const token = authHeader.split(" ")[1];

    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(JWT_SECRET)
      );

      (request.event as any).user = payload;
    } catch {
      throw new UnauthorizedError("Invalid or expired token");
    }
  };

  const onError = async (request: Request) => {
    if (request.error instanceof UnauthorizedError) {
      request.response = sendResponse(401, {
        error: "Unauthorized",
        message: request.error.message,
      });
    }
  };

  return {
    before,
    onError
  }
};

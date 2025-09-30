import type { MiddlewareObj, Request } from "@middy/core";

interface CustomError extends Error {
    statusCode?: number;
    expose?: boolean;
}

export const errorHandler = (): MiddlewareObj => ({
  onError: (request: Request<unknown, any, any>) => {
    const e = (request.error || {}) as CustomError;
    console.error("Unhandled error: ", e);

    const status = e.statusCode || 500;
    const message = e.expose ? e.message : "An unexpected error occurred";

    request.response = {
      statusCode: status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: e.name || "Error",
        message,
      }),
    };
  },
});

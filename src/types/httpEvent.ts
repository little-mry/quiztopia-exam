import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { JWTPayload } from "jose";

export type HttpEventWithAuthAndBody<TBody> =
  Omit<APIGatewayProxyEventV2, "body"> & {
    body: TBody; // jsonBodyParser gör body till ett objekt
    auth: {
      userId: string;
      username?: string;
      email?: string;
      raw?: JWTPayload;
    };
  };
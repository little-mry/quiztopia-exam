import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

export function sendResponse<T extends object>(
  statusCode: number,
  data: T
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(data, null, 2),
  };
}

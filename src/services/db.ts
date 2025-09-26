import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const client: DynamoDBClient = new DynamoDBClient({ region: process.env.AWS_REGION ?? "eu-north-1" });

export { client };

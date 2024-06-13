import PostHogClient from "@/lib/posthog";
import { incrementTokenUsage } from "../drizzle/schema";

export async function incrementAndLogTokenUsage(
  userId: string,
  tokens: number
) {
  const { remaining, usageError } = await incrementTokenUsage(userId, tokens);

  if (!usageError) {
    const client = PostHogClient();
    if (client) {
      client.capture({
        distinctId: userId,
        event: "token_usage",
        properties: {
          remaining,
        },
      });
    }
  }
  return { remaining, usageError };
}

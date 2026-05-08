import { Redis } from "@upstash/redis";

/** Single KV document for the whole question bank (lazy-seeded from bundle). */
export const QUESTIONS_BANK_KV_KEY = "skill-game:questions:bank:v1";

function redisClient(): Redis | null {
  const url = process.env.KV_REST_API_URL?.trim();
  const token = process.env.KV_REST_API_TOKEN?.trim();
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function isQuestionShape(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.role !== "string" || typeof row.level !== "string") return false;
  if (typeof row.category !== "string" || typeof row.question !== "string") return false;
  if (!Array.isArray(row.options)) return false;
  return row.options.every((opt) => {
    if (!opt || typeof opt !== "object") return false;
    const o = opt as Record<string, unknown>;
    return typeof o.text === "string" && typeof o.points === "number" && typeof o.feedback === "string";
  });
}

/**
 * Loads questions from KV when configured; otherwise returns seed.
 * First successful write seeds KV from the bundled dataset so content can later be updated in Redis without redeploying the client bundle.
 */
export async function loadQuestionBank<T>(seedQuestions: T[]): Promise<T[]> {
  const redis = redisClient();
  if (!redis) return seedQuestions;

  try {
    const cached = await redis.get<unknown>(QUESTIONS_BANK_KV_KEY);
    if (Array.isArray(cached) && cached.length > 0 && cached.every(isQuestionShape)) {
      return cached as T[];
    }
    await redis.set(QUESTIONS_BANK_KV_KEY, seedQuestions);
    return seedQuestions;
  } catch {
    return seedQuestions;
  }
}

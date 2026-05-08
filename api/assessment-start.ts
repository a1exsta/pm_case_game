import { assessmentData } from "../src/data/questions";
import { loadQuestionBank } from "./_lib/questions-bank";
import { loadSeenQuestionIds, saveSeenQuestionIds } from "./_lib/seen-questions-storage";

interface StartRequestBody {
  playerId?: string;
  role?: string;
  level?: string;
  questionCount?: number;
  clientSeenQuestionIds?: string[];
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function createSeededRandom(seed: number) {
  let state = seed || 1;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function pickRandomIds(ids: string[], seedKey: string, limit: number) {
  const random = createSeededRandom(hashString(seedKey));
  const pool = [...ids];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(limit, pool.length));
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body: StartRequestBody = req.body ?? {};
    const playerId = String(body.playerId ?? "").trim();
    const role = String(body.role ?? "").trim();
    const level = String(body.level ?? "").trim();
    const questionCount = Math.max(1, Math.min(24, Number(body.questionCount ?? 8)));
    const clientSeenQuestionIds = Array.isArray(body.clientSeenQuestionIds) ? body.clientSeenQuestionIds.map(String) : [];

    const isValidRole = assessmentData.roles.includes(role as (typeof assessmentData.roles)[number]);
    const isValidLevel = assessmentData.levels.includes(level as (typeof assessmentData.levels)[number]);
    if (!playerId || !isValidRole || !isValidLevel) {
      return res.status(400).json({ error: "Invalid playerId, role, or level" });
    }

    const bank = await loadQuestionBank(assessmentData.questions);
    const trackQuestions = bank.filter((item) => item.role === role && item.level === level);
    const allIds = trackQuestions.map((item) => item.id);
    const trackKey = `${playerId}::${role}::${level}`;
    const persistedSeen = await loadSeenQuestionIds(trackKey);
    const mergedSeen = new Set<string>([...persistedSeen, ...clientSeenQuestionIds]);

    let available = allIds.filter((id) => !mergedSeen.has(id));
    let resetApplied = false;
    if (available.length === 0) {
      available = [...allIds];
      mergedSeen.clear();
      resetApplied = true;
    }

    const seedKey = `${trackKey}-${Date.now()}`;
    const questionIds = pickRandomIds(available, seedKey, questionCount);
    for (const id of questionIds) {
      mergedSeen.add(id);
    }
    await saveSeenQuestionIds(trackKey, Array.from(mergedSeen));

    const byId = new Map(bank.map((item) => [item.id, item]));
    const questions = questionIds.map((id) => byId.get(id)).filter(Boolean);

    return res.status(200).json({
      questionIds,
      questions,
      resetApplied,
      totalTrackQuestions: allIds.length,
      remainingUnseen: Math.max(0, allIds.length - mergedSeen.size),
      bankSize: bank.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}

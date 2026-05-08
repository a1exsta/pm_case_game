const KV_URL = process.env.KV_REST_API_URL ?? "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN ?? "";

const memoryStore = new Map<string, string[]>();

function canUseKv() {
  return Boolean(KV_URL && KV_TOKEN);
}

function createKey(trackKey: string) {
  return `assessment:seen:${trackKey}`;
}

async function kvGet(trackKey: string): Promise<string[] | null> {
  const key = createKey(trackKey);
  const response = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`KV get failed: ${response.status}`);
  }
  const payload = await response.json();
  const raw = payload?.result;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

async function kvSet(trackKey: string, values: string[]) {
  const key = createKey(trackKey);
  const body = JSON.stringify(values);
  const response = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(body)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`KV set failed: ${response.status}`);
  }
}

export async function loadSeenQuestionIds(trackKey: string) {
  if (!canUseKv()) {
    return memoryStore.get(trackKey) ?? [];
  }
  try {
    const fromKv = await kvGet(trackKey);
    return fromKv ?? [];
  } catch {
    return memoryStore.get(trackKey) ?? [];
  }
}

export async function saveSeenQuestionIds(trackKey: string, values: string[]) {
  const uniqueValues = Array.from(new Set(values));
  memoryStore.set(trackKey, uniqueValues);
  if (!canUseKv()) return;
  try {
    await kvSet(trackKey, uniqueValues);
  } catch {
    // keep memory fallback updated even when KV request fails
  }
}

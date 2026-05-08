interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

const GIGACHAT_BASE_URL = "https://gigachat.devices.sberbank.ru/api/v1";
const GIGACHAT_OAUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";
const GIGACHAT_MODEL = "GigaChat";
const GIGACHAT_CLIENT_ID = "a078867e-1a32-450f-8ca7-2da62337ba3b";
const GIGACHAT_AUTH_KEY = "YTA3ODg2N2UtMWEzMi00NTBmLThjYTctMmRhNjIzMzdiYTNiOjcxNzNhZThlLTA4MDktNDJjNS1iZWUwLTc4NzBjNzdkYThlNQ==";
const GIGACHAT_SCOPE = "GIGACHAT_API_PERS";

let cachedToken: string | null = null;
let cachedTokenExpiresAt = 0;

function createRequestId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}`;
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedTokenExpiresAt - 30 > now) {
    return cachedToken;
  }

  const response = await fetch(GIGACHAT_OAUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${GIGACHAT_AUTH_KEY}`,
      RqUID: createRequestId(),
    },
    body: new URLSearchParams({ scope: GIGACHAT_SCOPE }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`OAuth ${response.status}: ${text.slice(0, 300)}`);
  }

  const payload = JSON.parse(text);
  const accessToken = payload?.access_token;
  const expiresAt = Number(payload?.expires_at ?? 0);
  if (!accessToken) {
    throw new Error("OAuth response has no access_token");
  }

  cachedToken = accessToken;
  cachedTokenExpiresAt = expiresAt || now + 25 * 60;
  return accessToken;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      systemContext,
      messages = [],
    }: {
      systemContext?: string;
      messages?: IncomingMessage[];
    } = req.body ?? {};

    const token = await getAccessToken();
    const response = await fetch(`${GIGACHAT_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-Request-ID": createRequestId(),
        "X-Client-ID": GIGACHAT_CLIENT_ID,
      },
      body: JSON.stringify({
        model: GIGACHAT_MODEL,
        stream: false,
        messages: [{ role: "system", content: systemContext ?? "" }, ...messages],
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      return res.status(response.status).json({ error: text.slice(0, 500) });
    }

    const payload = JSON.parse(text);
    const assistantText = payload?.choices?.[0]?.message?.content?.trim?.() ?? "";
    return res.status(200).json({ assistantText, payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}

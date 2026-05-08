export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      oauthUrl = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
      authKey,
      scope = "GIGACHAT_API_PERS",
    } = req.body ?? {};

    if (!authKey) {
      return res.status(400).json({ error: "Missing authKey" });
    }

    const requestId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}`;
    const body = new URLSearchParams({ scope });

    const response = await fetch(oauthUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${authKey}`,
        RqUID: requestId,
      },
      body,
    });

    const text = await response.text();
    if (!response.ok) {
      return res.status(response.status).json({ error: text.slice(0, 500) });
    }

    const payload = JSON.parse(text);
    return res.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}

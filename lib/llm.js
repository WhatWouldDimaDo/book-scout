// Shared OpenRouter chat helper. Free models first; OpenRouter's `models` array
// falls back automatically on errors/rate limits. Paid Haiku is the last resort.
const MODEL_CHAIN = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "anthropic/claude-haiku-4.5",
];

export async function chatCompletion({ system, user, maxTokens = 1200, timeoutMs = 25000 }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("no_api_key");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_CHAIN[0],
        models: MODEL_CHAIN,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`openrouter_${res.status}: ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    return {
      content: data?.choices?.[0]?.message?.content || "",
      model: data?.model || null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function extractJsonArray(text) {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

// Calls any OpenAI-compatible chat completions API.
// Default is Groq's free tier. To switch provider, change the three env vars:
//   Groq:   LLM_BASE_URL=https://api.groq.com/openai/v1   LLM_MODEL=openai/gpt-oss-120b
//   OpenAI: LLM_BASE_URL=https://api.openai.com/v1         LLM_MODEL=gpt-4o-mini
//   Gemini: LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai   LLM_MODEL=gemini-2.5-flash
//   xAI:    LLM_BASE_URL=https://api.x.ai/v1               LLM_MODEL=<a grok model id>

const DEFAULT_BASE = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "openai/gpt-oss-120b";

export async function chatCompletion(messages, { fetchImpl = fetch, env = process.env } = {}) {
  const key = env.LLM_API_KEY;
  if (!key) throw Object.assign(new Error("LLM_API_KEY is not set"), { code: "NO_KEY" });

  const base = (env.LLM_BASE_URL || DEFAULT_BASE).replace(/\/$/, "");
  const model = env.LLM_MODEL || DEFAULT_MODEL;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetchImpl(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_tokens: Number(env.LLM_MAX_TOKENS || 700),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw Object.assign(new Error(`LLM API ${res.status}: ${text.slice(0, 300)}`), { code: "UPSTREAM", status: res.status });
    }
    const data = await res.json();
    const answer = data?.choices?.[0]?.message?.content?.trim();
    if (!answer) throw Object.assign(new Error("Empty answer from model"), { code: "EMPTY" });
    return { answer, usage: data.usage || null, model };
  } finally {
    clearTimeout(timer);
  }
}

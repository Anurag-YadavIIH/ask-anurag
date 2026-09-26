// Calls any OpenAI-compatible chat completions API.
// Default is Groq's free tier. To switch provider, change the three env vars:
//   Groq:   LLM_BASE_URL=https://api.groq.com/openai/v1   LLM_MODEL=openai/gpt-oss-120b
//   OpenAI: LLM_BASE_URL=https://api.openai.com/v1         LLM_MODEL=gpt-4o-mini
//   Gemini: LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai   LLM_MODEL=gemini-2.5-flash
//   xAI:    LLM_BASE_URL=https://api.x.ai/v1               LLM_MODEL=<a grok model id>

const DEFAULT_BASE = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "openai/gpt-oss-120b";

// Models often emit typographic characters that look normal but break copy-paste
// (an email with a zero-width space, a URL with a non-breaking hyphen) and
// keyword checks. Map them to plain ASCII, and replace em dashes, which the
// prompt forbids but the model sometimes uses anyway.
export function sanitizeText(text) {
  return String(text)
    .replace(/[\u200B\u200C\u200D\u2060\uFEFF\u00AD]/g, "") // zero-width chars, soft hyphen
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ") // Unicode spaces
    .replace(/[\u2010\u2011\u2012\u2013\u2212\uFE63\uFF0D]/g, "-") // hyphens, en dash, minus
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/^( *)\u2014 */gm, "$1- ") // em dash used as a bullet
    .replace(/([.!?:;]) *\u2014 */g, "$1 ") // em dash after other punctuation
    .replace(/ *\u2014 */g, ", ")
    .replace(/,(?: *,)+/g, ",")
    .replace(/(\S) {2,}/g, "$1 ") // collapse inner runs of spaces, keep indentation
    .replace(/[ \t]+$/gm, ""); // trailing spaces on each line
}

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
    const content = data?.choices?.[0]?.message?.content;
    const answer = content ? sanitizeText(content).trim() : "";
    if (!answer) throw Object.assign(new Error("Empty answer from model"), { code: "EMPTY" });
    return { answer, usage: data.usage || null, model };
  } finally {
    clearTimeout(timer);
  }
}

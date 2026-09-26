// POST /api/chat
// Body: { "messages": [ { "role": "user" | "assistant", "content": "..." }, ... ] }
// Reply: { "answer": "...", "remaining": 3 }  or  { "error": "...", "limit": true }

import { SYSTEM_PROMPT, CONTACT_EMAIL } from "../lib/prompt.js";
import { chatCompletion } from "../lib/llm.js";
import { createLimiter } from "../lib/limits.js";

const MAX_QUESTION_CHARS = 500;
const MAX_TURN_CHARS = 1500;
const HISTORY_TURNS = 6; // last 3 exchanges are enough context and keep tokens low

let limiter;

function send(res, status, body, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body; // Vercel parses JSON for us
  if (typeof req.body === "string") return JSON.parse(req.body);
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 20000) throw new Error("Body too large");
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return String(fwd).split(",")[0].trim();
  return req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}

function corsHeaders(req, env) {
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.origin;
  if (origin && allowed.includes(origin)) return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
  return {};
}

// Keeps only well-formed user/assistant turns, trims them, and caps history length.
export function cleanMessages(raw) {
  if (!Array.isArray(raw)) return null;
  const msgs = raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_TURN_CHARS) }))
    .filter((m) => m.content.length > 0)
    .slice(-HISTORY_TURNS);
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return null;
  return msgs;
}

export function makeHandler({ env = process.env, llm = chatCompletion, limiterImpl } = {}) {
  return async function handler(req, res) {
    const cors = corsHeaders(req, env);
    if (req.method === "OPTIONS") {
      return send(res, 204, {}, { ...cors, "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" });
    }
    if (req.method !== "POST") return send(res, 405, { error: "Use POST." }, cors);

    let body;
    try {
      body = await readJson(req);
    } catch {
      return send(res, 400, { error: "Invalid JSON." }, cors);
    }

    const messages = cleanMessages(body?.messages);
    if (!messages) return send(res, 400, { error: "Send at least one question." }, cors);
    const question = messages[messages.length - 1].content;
    if (question.length > MAX_QUESTION_CHARS) {
      return send(res, 400, { error: `Please keep questions under ${MAX_QUESTION_CHARS} characters.` }, cors);
    }

    const lim = limiterImpl || (limiter ||= createLimiter({ env }));
    const ip = clientIp(req);
    let quota;
    try {
      quota = await lim.consume(ip);
    } catch (e) {
      console.error("limit store error", e);
      return send(res, 503, { error: "The chat is busy right now. Please try again in a minute." }, cors);
    }
    if (!quota.allowed) {
      const msg =
        quota.reason === "global"
          ? `AI Anurag has answered all the questions it can for today. Please email me at ${CONTACT_EMAIL} and I'll reply personally.`
          : `You've used all your questions for today. I'd love to continue the conversation directly: email me at ${CONTACT_EMAIL} or message me on LinkedIn.`;
      return send(res, 429, { error: msg, limit: true, remaining: 0 }, cors);
    }

    try {
      const { answer, usage, model } = await llm([{ role: "system", content: SYSTEM_PROMPT }, ...messages], { env });
      // Logged to Vercel's function logs so you can see what recruiters ask. No IPs are logged.
      console.log(JSON.stringify({ event: "qa", q: question, a: answer.slice(0, 400), model, usage }));
      return send(res, 200, { answer, remaining: quota.remaining }, cors);
    } catch (e) {
      console.error("llm error", e.code || "", e.message);
      await lim.refund?.(ip).catch(() => {});
      return send(res, 502, { error: `I couldn't answer just now. Please try again, or email me at ${CONTACT_EMAIL}.`, remaining: quota.remaining + 1 }, cors);
    }
  };
}

export default makeHandler();

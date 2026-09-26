// Runs the question set against the real model and checks each answer.
//
//   Against the model directly (needs LLM_API_KEY in .env.local):
//     npm run eval
//   Against your deployed site (uses up that site's limits, so raise them first):
//     EVAL_URL=https://your-site.vercel.app/api/chat npm run eval
//
// Each case has "expect" (every regex must match, | means either) and optional
// "forbid" (none may match). Checks are case-insensitive keyword tests, so read
// the failures yourself before deciding the bot is wrong.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SYSTEM_PROMPT } from "../lib/prompt.js";
import { chatCompletion } from "../lib/llm.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
for (const f of [".env.local", ".env"]) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const cases = JSON.parse(fs.readFileSync(path.join(root, "evals/questions.json"), "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function answer(q) {
  if (process.env.EVAL_URL) {
    const r = await fetch(process.env.EVAL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: q }] }),
    });
    const d = await r.json();
    return d.answer || `[error ${r.status}] ${d.error}`;
  }
  return (await chatCompletion([{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: q }])).answer;
}

// Free-tier providers return 429 when the tokens-per-minute limit is hit.
// Wait and retry instead of counting it as a failed answer.
const RETRY_WAITS_MS = [20000, 40000, 60000];
async function answerWithRetry(q) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await answer(q);
    } catch (e) {
      if (e.status !== 429 || attempt >= RETRY_WAITS_MS.length) throw e;
      const wait = RETRY_WAITS_MS[attempt];
      console.log(`      rate limited, retrying in ${wait / 1000}s (${attempt + 1}/${RETRY_WAITS_MS.length})`);
      await sleep(wait);
    }
  }
}

let pass = 0;
const failures = [];
for (const [i, c] of cases.entries()) {
  let a;
  try {
    a = await answerWithRetry(c.q);
  } catch (e) {
    a = `[error] ${e.message}`;
  }
  const missing = (c.expect || []).filter((re) => !new RegExp(re, "i").test(a));
  const forbidden = (c.forbid || []).filter((re) => new RegExp(re, "i").test(a));
  const emDash = a.includes("\u2014");
  const ok = !missing.length && !forbidden.length && !emDash;
  if (ok) pass++;
  else failures.push({ q: c.q, a, missing, forbidden, emDash });
  console.log(`${ok ? "PASS" : "FAIL"}  ${String(i + 1).padStart(2)}. ${c.q}`);
  await sleep(Number(process.env.EVAL_DELAY_MS || 4000)); // stay under free-tier rate limits
}

console.log(`\n${pass}/${cases.length} passed\n`);
for (const f of failures) {
  console.log(`Q: ${f.q}\nA: ${f.a}`);
  if (f.missing.length) console.log(`   missing: ${f.missing.join(", ")}`);
  if (f.forbidden.length) console.log(`   forbidden: ${f.forbidden.join(", ")}`);
  if (f.emDash) console.log("   contains an em dash");
  console.log();
}
process.exitCode = failures.length ? 1 : 0;

// Runs the question set and checks each answer.
//
//   Through the same pipeline the site uses (system prompt, model, banned-claims
//   and placeholder guard). Needs LLM_API_KEY in .env.local:
//     npm run eval
//   Only some questions (prints every answer, not just failures):
//     npm run eval -- "When can you join?" "Why should we hire you?"
//   Against your deployed site (uses up that site's limits, so raise them first):
//     EVAL_URL=https://your-site.vercel.app/api/chat npm run eval
//
// Each case has "expect" (every regex must match, | means either) and optional
// "forbid" (none may match). Every answer also fails on an em dash, a Markdown
// link ("](") or a placeholder link such as [link]. Checks are case-insensitive
// keyword tests, so read the failures yourself before deciding the bot is wrong.
// Answers are printed with JSON.stringify, so you see the exact text.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SYSTEM_PROMPT } from "../lib/prompt.js";
import { chatCompletion, findPlaceholders } from "../lib/llm.js";
import { answerWithGuard } from "../api/chat.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
for (const f of [".env.local", ".env"]) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const all = JSON.parse(fs.readFileSync(path.join(root, "evals/questions.json"), "utf8"));
const only = process.argv.slice(2);
const unknown = only.filter((q) => !all.some((c) => c.q === q));
if (unknown.length) {
  console.error(`Not in evals/questions.json: ${unknown.map((q) => JSON.stringify(q)).join(", ")}`);
  process.exit(1);
}
const cases = only.length ? all.filter((c) => only.includes(c.q)) : all;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The model call. Free-tier providers return 429 when the tokens-per-minute limit
// is hit: wait and retry instead of counting it as a failed answer. A daily-limit
// 429 is thrown straight away, because waiting a minute won't help.
const RETRY_WAITS_MS = [20000, 40000, 60000];
async function model(messages, opts) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await chatCompletion(messages, opts);
    } catch (e) {
      if (e.status !== 429 || /tokens per day/i.test(e.message) || attempt >= RETRY_WAITS_MS.length) throw e;
      const wait = RETRY_WAITS_MS[attempt];
      console.log(`      rate limited, retrying in ${wait / 1000}s (${attempt + 1}/${RETRY_WAITS_MS.length})`);
      await sleep(wait);
    }
  }
}

// Returns the answer as a visitor would get it, plus any guard log lines.
async function answer(q) {
  if (process.env.EVAL_URL) {
    const r = await fetch(process.env.EVAL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: q }] }),
    });
    const d = await r.json();
    return { a: d.answer || `[error ${r.status}] ${d.error}`, guard: [] };
  }
  const guard = [];
  const log = console.log;
  console.log = (...args) => {
    const line = args.join(" ");
    if (line.includes('"event":"guard"')) guard.push(line);
    else log(...args);
  };
  try {
    const out = await answerWithGuard(model, [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: q }], {});
    return { a: out.answer, guard };
  } finally {
    console.log = log;
  }
}

let pass = 0;
const failures = [];
for (const c of cases) {
  const n = all.indexOf(c) + 1;
  let a, guard = [];
  try {
    ({ a, guard } = await answer(c.q));
  } catch (e) {
    a = `[error] ${e.message}`;
  }
  const missing = (c.expect || []).filter((re) => !new RegExp(re, "i").test(a));
  const forbidden = (c.forbid || []).filter((re) => new RegExp(re, "i").test(a));
  const emDash = a.includes("—");
  const markdown = a.includes("](");
  const placeholders = findPlaceholders(a);
  const ok = !missing.length && !forbidden.length && !emDash && !markdown && !placeholders.length;
  if (ok) pass++;
  else failures.push({ n, q: c.q, a, missing, forbidden, emDash, markdown, placeholders });
  console.log(`${ok ? "PASS" : "FAIL"}  ${String(n).padStart(2)}. ${c.q}`);
  for (const g of guard) console.log(`      guard fired: ${g}`);
  if (only.length) console.log(`      A: ${JSON.stringify(a)}`);
  await sleep(Number(process.env.EVAL_DELAY_MS || 4000)); // stay under free-tier rate limits
}

console.log(`\n${pass}/${cases.length} passed\n`);
for (const f of failures) {
  console.log(`Q${f.n}: ${f.q}\nA: ${JSON.stringify(f.a)}`);
  if (f.missing.length) console.log(`   missing: ${f.missing.join(", ")}`);
  if (f.forbidden.length) console.log(`   forbidden: ${f.forbidden.join(", ")}`);
  if (f.emDash) console.log("   contains an em dash");
  if (f.markdown) console.log('   contains a Markdown link ("](")');
  if (f.placeholders.length) console.log(`   contains placeholder links: ${f.placeholders.join(" ")}`);
  console.log();
}
process.exitCode = failures.length ? 1 : 0;

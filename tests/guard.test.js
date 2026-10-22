// Unit tests for the banned-claims guard: run with  npm test
import { test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { findBannedClaims, removeBannedClaims } from "../lib/llm.js";
import { answerWithGuard, makeHandler, GUARD_FALLBACK } from "../api/chat.js";
import { createLimiter, _resetMemory } from "../lib/limits.js";

// The real "Why should we hire you?" answer that failed the check, verbatim.
const FAILED_HIRE_ANSWER = `I bring a rare blend of eye-care domain expertise and hands-on AI engineering:

- M.Tech in Ophthalmic Engineering (IIT Hyderabad, CGPA 9.18) gives me deep knowledge of ocular anatomy, imaging and biomechanics.
- Current medical-imaging AI work: OcuVal (cross-vendor OCT fluid segmentation) and RetinaPrep (rigorous dataset audit for leakage).
- Proven ability to build secure GenAI systems, e.g., ConsultRAG, where I measured retrieval quality with a gold-question set.
- Internship at Orbees Medical gave me practical insight into US healthcare markets, med-tech competitors and delivery models.
- Strong technical stack: Python, deep-learning (TensorFlow, scikit-learn), DICOM handling, FastAPI, Docker, PostgreSQL, LangChain, etc.

I'm eager to apply this mix to a healthcare-focused AI/ML role. Please email me at ritesh.anurag325@gmail.com to discuss further.`;

const CLEAN = "I studied at IIT Hyderabad. My current project is OcuVal.";

beforeEach(() => {
  _resetMemory();
  mock.method(console, "log", () => {});
});
afterEach(() => mock.restoreAll());

test("detector finds each banned phrase, case-insensitively", () => {
  assert.deepEqual(findBannedClaims("Proven track record."), ["proven"]);
  assert.deepEqual(findBannedClaims("Uses production-grade tooling."), ["production-grade"]);
  assert.deepEqual(findBannedClaims("It is Production-Ready."), ["production-ready"]);
  assert.deepEqual(findBannedClaims("I deployed to production last year."), ["deployed to production"]);
  assert.deepEqual(findBannedClaims("The model runs in production."), ["in production"]);
  assert.deepEqual(findBannedClaims("Docs are IEC 62304 compliant."), ["IEC 62304 compliant"]);
  assert.deepEqual(findBannedClaims("Documented to IEC 62304 standards."), ["to IEC 62304 standards"]);
  assert.deepEqual(findBannedClaims("Proven, and in production."), ["proven", "in production"]);
});

test("detector skips claims negated by none, aren't, weren't, nor and without", () => {
  assert.deepEqual(findBannedClaims("None of my projects are in production."), []);
  assert.deepEqual(findBannedClaims("My projects aren't deployed to production."), []);
  assert.deepEqual(findBannedClaims("They weren't production-ready."), []);
  assert.deepEqual(findBannedClaims("Neither deployed nor in production."), []);
  assert.deepEqual(findBannedClaims("Built as portfolio work without production-grade claims."), []);
});

test("detector skips negated claims within 5 words in the same sentence", () => {
  assert.deepEqual(findBannedClaims("These are portfolio efforts, not deployed in production."), []);
  assert.deepEqual(findBannedClaims("I have never used Kubernetes in production."), []);
  assert.deepEqual(findBannedClaims("It isn't production-ready yet."), []);
  assert.deepEqual(findBannedClaims("OcuVal wasn't deployed to production."), []);
  assert.deepEqual(findBannedClaims("There is no production-grade claim here."), []);
  // "not" is too far back, or in the previous sentence
  assert.deepEqual(findBannedClaims("Not every project I built here is proven."), ["proven"]);
  assert.deepEqual(findBannedClaims("That was not ideal. It runs in production."), ["in production"]);
});

test("detector has no false positives on similar words", () => {
  assert.deepEqual(findBannedClaims("I improve models and track data provenance. Improvements are reproducible."), []);
  assert.deepEqual(findBannedClaims("Documentation modelled on IEC 62304, the medical device software standard."), []);
  assert.deepEqual(findBannedClaims("I worked on productions in my spare time."), []);
});

test("the failed hire answer is detected", () => {
  assert.deepEqual(findBannedClaims(FAILED_HIRE_ANSWER), ["proven"]);
});

test("fallback removes only the ConsultRAG bullet and keeps valid markdown", () => {
  const expected = FAILED_HIRE_ANSWER.split("\n").filter((l) => !l.startsWith("- Proven ability")).join("\n");
  assert.equal(removeBannedClaims(FAILED_HIRE_ANSWER), expected);
});

test("fallback removes a sentence in a paragraph and leaves the rest intact", () => {
  const text = "I studied at IIT Hyderabad. My pipeline is production-grade, e.g. for OCT. I built OcuVal. Email me for more.";
  assert.equal(removeBannedClaims(text), "I studied at IIT Hyderabad. I built OcuVal. Email me for more.");
});

test("fallback removes nested lines with their list item", () => {
  const text = "My projects:\n- OcuVal, in progress.\n- ConsultRAG is in production.\n  - Used by clients.\n- RetinaPrep audits data.";
  assert.equal(removeBannedClaims(text), "My projects:\n- OcuVal, in progress.\n- RetinaPrep audits data.");
});

test("fallback never leaves an empty list or a dangling lead-in", () => {
  const text = "Here is why:\n\n- Proven results.\n- Production-ready code.\n\nI studied at IIT Hyderabad. I built OcuVal.";
  assert.equal(removeBannedClaims(text), "I studied at IIT Hyderabad. I built OcuVal.");
});

test("fallback never leaves a dangling heading", () => {
  const text = "## Deployment\n\nIt runs in production.\n\n## Education\n\nI studied at IIT Hyderabad. CGPA 9.18.";
  assert.equal(removeBannedClaims(text), "## Education\n\nI studied at IIT Hyderabad. CGPA 9.18.");
});

test("fallback returns null when under 2 sentences would remain", () => {
  assert.equal(removeBannedClaims("I have proven skills. Email me."), null);
  assert.equal(removeBannedClaims("- Proven skills.\n- Production-grade code.\n- Python."), null);
});

// A fake model that returns the given answers in order (an Error is thrown).
function seqLlm(...answers) {
  const calls = [];
  const llm = async (messages) => {
    calls.push(messages);
    const a = answers[calls.length - 1];
    if (a instanceof Error) throw a;
    return { answer: a, usage: null, model: "test" };
  };
  return { llm, calls };
}

test("retry: bad then clean returns the clean answer and names the phrase", async () => {
  const { llm, calls } = seqLlm(FAILED_HIRE_ANSWER, CLEAN);
  const out = await answerWithGuard(llm, [{ role: "user", content: "Why hire you?" }], {});
  assert.equal(out.answer, CLEAN);
  assert.equal(calls.length, 2);
  const note = calls[1].at(-1);
  assert.equal(note.role, "system");
  assert.match(note.content, /"proven"/);
  assert.equal(calls[1].at(-2).content, FAILED_HIRE_ANSWER);
});

test("retry: bad then bad returns the cleaned first answer", async () => {
  const { llm } = seqLlm(FAILED_HIRE_ANSWER, "It is production-grade. Truly proven.");
  const out = await answerWithGuard(llm, [{ role: "user", content: "Why hire you?" }], {});
  assert.equal(out.answer, removeBannedClaims(FAILED_HIRE_ANSWER));
});

test("retry: bad then error returns the cleaned first answer", async () => {
  const { llm } = seqLlm(FAILED_HIRE_ANSWER, new Error("upstream 500"));
  const out = await answerWithGuard(llm, [{ role: "user", content: "Why hire you?" }], {});
  assert.equal(out.answer, removeBannedClaims(FAILED_HIRE_ANSWER));
});

test("retry: email fallback when cleaning leaves too little", async () => {
  const { llm } = seqLlm("I have proven skills. Email me.", new Error("down"));
  const out = await answerWithGuard(llm, [{ role: "user", content: "hi" }], {});
  assert.equal(out.answer, GUARD_FALLBACK);
});

test("clean answers make exactly one model call", async () => {
  const { llm, calls } = seqLlm(CLEAN);
  const out = await answerWithGuard(llm, [{ role: "user", content: "hi" }], {});
  assert.equal(out.answer, CLEAN);
  assert.equal(calls.length, 1);
});

test("a guarded retry counts as one question and logs one line without question text", async () => {
  const env = { PER_VISITOR_DAILY: "5", GLOBAL_DAILY: "8" };
  const { llm, calls } = seqLlm(FAILED_HIRE_ANSWER, CLEAN);
  const h = makeHandler({ env, llm, limiterImpl: createLimiter({ env }) });
  const res = { statusCode: 0, headers: {}, setHeader() {}, end(b) { this.body = JSON.parse(b); } };
  await h({ method: "POST", body: { messages: [{ role: "user", content: "Why should we hire you?" }] }, headers: { "x-forwarded-for": "9.9.9.9" }, socket: {} }, res);
  assert.equal(calls.length, 2);
  assert.equal(res.body.answer, CLEAN);
  assert.equal(res.body.remaining, 4);
  const guardLogs = console.log.mock.calls.map((c) => c.arguments[0]).filter((l) => l.includes('"event":"guard"'));
  assert.equal(guardLogs.length, 1);
  assert.deepEqual(JSON.parse(guardLogs[0]), { event: "guard", phrases: ["proven"], retry: "fixed" });
  assert.ok(!guardLogs[0].includes("hire"));
});

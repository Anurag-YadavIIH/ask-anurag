// How answers look in the chat bubble: Markdown links, bullets, placeholder links
// and email links. Run with  npm test
import { test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { sanitizeText, findPlaceholders, fixPlaceholders } from "../lib/llm.js";
import { RESUME_URL, CONTACT_EMAIL } from "../lib/prompt.js";
import { answerWithGuard } from "../api/chat.js";
import { linkify } from "../src/js/chat.js";

// Real answers from the eval run on the redesign branch, verbatim.
const HIRE_ANSWER = `I combine deep domain knowledge of the eye with hands-on AI engineering:

- M.Tech in Ophthalmic Engineering (IIT Hyderabad, CGPA 9.18) gives me strong ocular anatomy and imaging expertise.
- Current medical-imaging AI work: OcuVal (cross-vendor OCT fluid segmentation) and RetinaPrep (dataset audit for leakage).
- Built secure GenAI systems such as ConsultRAG, measuring retrieval quality with a gold-question set.
- Internship at Orbees Medical provided solid understanding of the US healthcare market, med-tech competitors and delivery models.
- I prioritize data quality, honest evaluation and thorough documentation, critical for medical AI.

You can see more details in my resume [link] and GitHub repos. I'd be happy to discuss further via email at ritesh.anurag325@gmail.com.`;

const JOIN_ANSWER = "I can join immediately. I'd prefer to discuss salary, interview timing and any other details directly by email at ritesh.anurag325@gmail.com.";

const MAILTO = `<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>`;

beforeEach(() => mock.method(console, "log", () => {}));
afterEach(() => mock.restoreAll());

// Runs an answer through what production does: the model client's sanitizeText,
// the guard (with a retry that returns `retry`), then the chat bubble's linkify.
async function render(answer, retry = answer) {
  const calls = [];
  const llm = async (messages) => {
    calls.push(messages);
    return { answer: sanitizeText(calls.length === 1 ? answer : retry), usage: null, model: "test" };
  };
  const out = await answerWithGuard(llm, [{ role: "user", content: "q" }], {});
  return { text: out.answer, html: linkify(out.answer), calls };
}

/* ---------- Markdown links and bullets ---------- */

test("Markdown links become plain text", () => {
  assert.equal(sanitizeText(`[${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL})`), CONTACT_EMAIL);
  assert.equal(sanitizeText("See [here](https://example.com/a)."), "See https://example.com/a.");
  assert.equal(sanitizeText("My [resume](https://drive.google.com/x) and [LinkedIn profile](https://linkedin.com/in/y)"), "My https://drive.google.com/x and https://linkedin.com/in/y");
  assert.equal(sanitizeText("[https://a.io/x](https://a.io/x)"), "https://a.io/x");
  assert.equal(sanitizeText("The [OcuVal repo](https://github.com/u/ocuval)"), "The OcuVal repo: https://github.com/u/ocuval");
  assert.equal(sanitizeText("Email [me directly](mailto:a@b.co)"), "Email me directly: a@b.co");
});

test('"* " and "- " bullets become "• " and keep their indentation', () => {
  assert.equal(sanitizeText("Skills:\n* Python\n- SQL\n  - nested"), "Skills:\n• Python\n• SQL\n  • nested");
  assert.equal(sanitizeText("**Bold heading**\n2023-2025 is not a bullet"), "Bold heading\n2023-2025 is not a bullet");
});

test("bold markers and headings are stripped", () => {
  assert.equal(sanitizeText("I built **OcuVal** and __RetinaPrep__."), "I built OcuVal and RetinaPrep.");
  assert.equal(sanitizeText("## Projects\nText\n###### Small"), "Projects\nText\nSmall");
  assert.equal(sanitizeText("**Associate Consultant Intern, Orbees Medical (Aug 2025 - Oct 2025)**"), "Associate Consultant Intern, Orbees Medical (Aug 2025 - Oct 2025)");
  assert.equal(sanitizeText(`Email **${CONTACT_EMAIL}** today`), `Email ${CONTACT_EMAIL} today`);
});

test("a bolded bullet becomes a plain bullet", () => {
  assert.equal(sanitizeText("* **OcuVal**: OCT fluid segmentation"), "• OcuVal: OCT fluid segmentation");
  assert.equal(sanitizeText("- **Skills:** Python, SQL"), "• Skills: Python, SQL");
});

test("single * and _ inside words and maths are left alone", () => {
  assert.equal(sanitizeText("see file_name and my_var_2, 2*3 = 6, a * b"), "see file_name and my_var_2, 2*3 = 6, a * b");
  assert.equal(sanitizeText("snake__case__name stays"), "snake__case__name stays");
  assert.equal(sanitizeText("#hashtag is not a heading"), "#hashtag is not a heading");
});

/* ---------- placeholders ---------- */

test("placeholder links are detected, real brackets are not", () => {
  assert.deepEqual(findPlaceholders("see [link], [URL], [here], [resume link] and [PDF]"), ["[link]", "[URL]", "[here]", "[resume link]", "[PDF]"]);
  assert.deepEqual(findPlaceholders("Reference [1] and the [OcuVal] project"), []);
});

test("a resume placeholder gets the resume URL; others are removed tidily", () => {
  assert.equal(fixPlaceholders("See my resume [link] and GitHub.", { resumeUrl: "https://r" }), "See my resume https://r and GitHub.");
  assert.equal(fixPlaceholders("Download it here: [resume link]", { resumeUrl: "https://r" }), "Download it here: https://r");
  assert.equal(fixPlaceholders("Read more [here].", { resumeUrl: "https://r" }), "Read more.");
  assert.equal(fixPlaceholders("Links:\n• [url]\n• Email me", { resumeUrl: "https://r" }), "Links:\n• Email me");
});

test("guard retries a placeholder with the URL note and uses a clean retry", async () => {
  const clean = `My resume is at ${RESUME_URL}.`;
  const { text, calls } = await render("My resume is at [resume link].", clean);
  assert.equal(text, clean);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].at(-1).content, "Use the actual URL from the FACTS, not a placeholder.");
});

/* ---------- today's answers, as the chat bubble renders them ---------- */

test('"Why should we hire you?" renders with no Markdown, no [link] and a working mailto', async () => {
  // Worst case: the retry repeats the placeholder, so the fallback fixes the first answer.
  const { text, html, calls } = await render(HIRE_ANSWER);
  assert.equal(calls.length, 2);
  assert.ok(!html.includes("]("), "no Markdown link syntax");
  assert.ok(!html.includes("[link]"), "no placeholder");
  assert.ok(html.includes(`${MAILTO}.`), "mailto link stops before the full stop");
  assert.ok(text.includes(`my resume ${RESUME_URL} and GitHub repos`), "resume placeholder replaced with the resume URL");
  assert.ok(html.includes(`<a href="${RESUME_URL}" target="_blank" rel="noopener">`), "resume URL is a link");
  assert.equal((text.match(/^• /gm) || []).length, 5, "five bullets");
  assert.ok(!/^- /m.test(text), 'no "- " bullets left');
});

test('"When can you join?" renders unchanged with a working mailto', async () => {
  const { text, html, calls } = await render(JOIN_ANSWER);
  assert.equal(calls.length, 1, "no guard retry");
  assert.equal(text, JOIN_ANSWER);
  assert.ok(!html.includes("](") && !html.includes("[link]"));
  assert.ok(html.endsWith(`${MAILTO}.`), "mailto link stops before the full stop");
});

test("a Markdown-link answer is linked once per address", async () => {
  const { html } = await render(`Email me at [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL}) or see my [resume](${RESUME_URL}).`);
  assert.ok(!html.includes("]("));
  assert.equal((html.match(/<a /g) || []).length, 2);
  assert.ok(html.includes(MAILTO));
});

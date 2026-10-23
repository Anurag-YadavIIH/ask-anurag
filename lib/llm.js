// Calls any OpenAI-compatible chat completions API.
// Default is Groq's free tier. To switch provider, change the three env vars:
//   Groq:   LLM_BASE_URL=https://api.groq.com/openai/v1   LLM_MODEL=openai/gpt-oss-120b
//   OpenAI: LLM_BASE_URL=https://api.openai.com/v1         LLM_MODEL=gpt-4o-mini
//   Gemini: LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai   LLM_MODEL=gemini-2.5-flash
//   xAI:    LLM_BASE_URL=https://api.x.ai/v1               LLM_MODEL=<a grok model id>

const DEFAULT_BASE = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "openai/gpt-oss-120b";

// Link labels that add nothing next to the address itself: [here](url) becomes just the url.
const GENERIC_LABELS = new Set([
  "link", "links", "here", "click here", "this", "url", "website", "site", "page", "view", "download",
  "resume", "resume pdf", "cv", "pdf", "email", "email me", "mail", "profile", "linkedin", "linkedin profile",
  "github", "repo", "repository", "code", "portfolio", "report", "reports",
]);

// The chat bubble shows plain text (links are added by the page), so a Markdown
// link would show its brackets and be linked twice. Keep only what a reader needs.
function plainLink(_, label, url) {
  const shown = url.replace(/^mailto:/i, "");
  const norm = label.toLowerCase().replace(/^(?:my|the)\s+/, "").replace(/[^a-z0-9@.]+/g, " ").trim();
  if (norm === shown.toLowerCase() || label.trim() === url || GENERIC_LABELS.has(norm)) return shown;
  return `${label.trim()}: ${shown}`;
}

// Models often emit typographic characters that look normal but break copy-paste
// (an email with a zero-width space, a URL with a non-breaking hyphen) and
// keyword checks. Map them to plain ASCII, and replace em dashes, which the
// prompt forbids but the model sometimes uses anyway. The chat shows plain text, so
// Markdown is flattened: links become plain text, **bold** and "# " headings lose
// their markers, and "* " or "- " bullets become "\u2022 ". Underscores are never
// touched (__init__.py, file_name), and a single * stays (2*3).
export function sanitizeText(text) {
  return String(text)
    .replace(/\u200B|\u200C|\u200D|\u2060|\uFEFF|\u00AD/g, "") // zero-width chars, soft hyphen
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ") // Unicode spaces
    .replace(/[\u2010\u2011\u2012\u2013\u2212\uFE63\uFF0D]/g, "-") // hyphens, en dash, minus
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/\[([^\]\n]+)\]\(\s*<?([^)\s>]+)>?\s*\)/g, plainLink) // [label](url)
    .replace(/\*\*(?=\S)([^*\n]+?)(?<=\S)\*\*/g, "$1") // **bold**
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, "") // "# " to "###### " headings
    .replace(/^( *)\u2014 */gm, "$1- ") // em dash used as a bullet
    .replace(/([.!?:;]) *\u2014 */g, "$1 ") // em dash after other punctuation
    .replace(/ *\u2014 */g, ", ")
    .replace(/,(?: *,)+/g, ",")
    .replace(/^([ \t]*)[*-][ \t]+/gm, "$1\u2022 ") // "* " and "- " bullets
    .replace(/(\S) {2,}/g, "$1 ") // collapse inner runs of spaces, keep indentation
    .replace(/[ \t]+$/gm, ""); // trailing spaces on each line
}

// Bracketed stand-ins the model writes instead of a real address: [link], [url],
// [here], [resume link], [PDF] and similar. Run after sanitizeText, so real
// Markdown links are already gone.
const PLACEHOLDER_RE = /\[(?:[a-z]+\s+)?(?:link|url|here)\]|\[(?:pdf|resume|cv)\]/gi;

export function findPlaceholders(text) {
  return String(text).match(PLACEHOLDER_RE) || [];
}

// Replaces a placeholder that stands for the resume (it says resume, CV or PDF,
// or follows "resume"/"CV" closely) with the resume URL, and drops any other.
export function fixPlaceholders(text, { resumeUrl = "" } = {}) {
  return String(text)
    .replace(PLACEHOLDER_RE, (match, offset, whole) => {
      const before = whole.slice(Math.max(0, offset - 30), offset).toLowerCase();
      const isResume = /resume|cv|pdf/i.test(match) || /\b(?:resume|cv)\b[^.\n]*$/.test(before);
      return isResume && resumeUrl ? resumeUrl : "";
    })
    .replace(/\(\s*\)/g, "")
    .replace(/(\S)[ \t]{2,}/g, "$1 ")
    .replace(/[ \t]+([.,;:!?)])/g, "$1")
    .replace(/^[ \t]*\u2022[ \t]*$\n?/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Claims the model must never make, even though the prompt forbids them. Matched
// case-insensitively on word boundaries, after sanitizeText has run.
export const BANNED_CLAIMS = [
  "proven",
  "production-grade",
  "production-ready",
  "deployed to production",
  "in production",
  "IEC 62304 compliant",
  "to IEC 62304 standards",
];
const NEGATIONS = new Set(["not", "never", "isn't", "wasn't", "aren't", "weren't", "no", "none", "nor", "without"]);
const NEGATION_WINDOW = 5; // words; "None of my projects are in production" needs 5
const CLAIM_RES = BANNED_CLAIMS.map((phrase) => ({
  phrase,
  re: new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+")}\\b`, "gi"),
}));
const ABBREV = /(?:^|[\s(])(?:e\.g|i\.e|etc|vs|dr|mr|ms|m\.tech|b\.tech|u\.s)\.$/i;
const LIST_ITEM = /^(\s*)(?:[-*+•]|\d+[.)])\s+/;
const HEADING = /^\s*(?:#{1,6}\s|\*\*[^*]+\*\*:?\s*$)/;

// A match is negated when "not", "never", "none", etc. appears within the 5 words
// before it in the same sentence ("not deployed in production" is allowed).
function isNegated(text, index) {
  const sentence = text.slice(0, index).split(/[.!?](?=\s)|\n/).pop();
  const words = sentence.toLowerCase().match(/[a-z']+/g) || [];
  return words.slice(-NEGATION_WINDOW).some((w) => NEGATIONS.has(w));
}

export function findBannedMatches(text) {
  const out = [];
  for (const { phrase, re } of CLAIM_RES) {
    for (const m of String(text).matchAll(re)) {
      if (!isNegated(text, m.index)) out.push({ phrase, index: m.index });
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

// The banned phrases an answer uses, so a retry instruction can name them.
export function findBannedClaims(text) {
  return [...new Set(findBannedMatches(text).map((m) => m.phrase))];
}

function isSentenceEnd(line, i) {
  return /[.!?]/.test(line[i]) && (i + 1 === line.length || /\s/.test(line[i + 1])) && !ABBREV.test(line.slice(0, i + 1));
}

function sentenceBounds(line, offset) {
  let start = 0;
  for (let i = offset - 1; i >= 0; i--) {
    if (isSentenceEnd(line, i)) {
      start = i + 1;
      break;
    }
  }
  let end = line.length;
  for (let i = offset; i < line.length; i++) {
    if (isSentenceEnd(line, i)) {
      end = i + 1;
      break;
    }
  }
  return [start, end];
}

function countSentences(line) {
  let n = 0;
  for (let i = 0; i < line.length; i++) if (isSentenceEnd(line, i)) n++;
  return Math.max(n, line.trim() ? 1 : 0);
}

// The list item a line belongs to: the line itself, or the item above an indented continuation line.
function enclosingItem(lines, li) {
  if (LIST_ITEM.test(lines[li])) return li;
  const indent = lines[li].match(/^\s*/)[0].length;
  if (!indent) return -1;
  for (let k = li - 1; k >= 0 && lines[k].trim(); k--) {
    const m = lines[k].match(LIST_ITEM);
    if (m && m[1].length < indent) return k;
  }
  return -1;
}

// Removes each banned claim with the unit that holds it: the whole list item
// (with its nested lines) inside a list, otherwise the sentence. Drops lead-ins
// left without their list and headings left without content. Returns null when
// fewer than 2 sentences or items of content would remain.
export function removeBannedClaims(text) {
  const matches = findBannedMatches(text);
  if (!matches.length) return text;
  const raw = String(text).split("\n");
  const starts = [];
  raw.reduce((pos, l) => (starts.push(pos), pos + l.length + 1), 0);
  const lineOf = (i) => starts.findLastIndex((s) => s <= i);
  const nextContent = (arr, i) => arr.slice(i + 1).find((l) => l.text.trim());

  const lines = raw.map((text) => ({ text, drop: false, cuts: [] }));
  lines.forEach((l, i) => {
    const next = nextContent(lines, i);
    l.leadIn = !LIST_ITEM.test(l.text) && /:\s*$/.test(l.text) && Boolean(next && LIST_ITEM.test(next.text));
  });

  for (const m of matches) {
    const li = lineOf(m.index);
    const item = enclosingItem(raw, li);
    if (item !== -1) {
      const indent = raw[item].match(LIST_ITEM)[1].length;
      lines[item].drop = true;
      for (let k = item + 1; k < raw.length && raw[k].trim() && raw[k].match(/^\s*/)[0].length > indent; k++) lines[k].drop = true;
    } else {
      lines[li].cuts.push(sentenceBounds(raw[li], m.index - starts[li]));
    }
  }

  let kept = [];
  for (const l of lines) {
    if (l.drop) continue;
    let t = l.text;
    for (const [s, e] of l.cuts.sort((a, b) => b[0] - a[0])) t = t.slice(0, s) + t.slice(e);
    if (l.cuts.length) t = t.replace(/\s{2,}/g, " ").trim();
    if (l.cuts.length && !t) continue;
    kept.push({ ...l, text: t });
  }

  // A lead-in needs its list; a heading needs something after it.
  for (let changed = true; changed; ) {
    changed = false;
    for (const [i, l] of kept.entries()) {
      if (!l.text.trim()) continue;
      const next = nextContent(kept, i);
      const dangling = l.leadIn
        ? !(next && LIST_ITEM.test(next.text))
        : HEADING.test(l.text) && (!next || HEADING.test(next.text));
      if (dangling) {
        kept = kept.filter((x) => x !== l);
        changed = true;
        break;
      }
    }
  }

  const out = kept.map((l) => l.text).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const units = kept.reduce((n, l) => {
    if (!l.text.trim() || l.leadIn || HEADING.test(l.text)) return n;
    return n + (LIST_ITEM.test(l.text) ? 1 : countSentences(l.text));
  }, 0);
  return units >= 2 ? out : null;
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

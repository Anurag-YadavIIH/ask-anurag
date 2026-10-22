# AI Anurag: a guarded resume chatbot on my portfolio

My portfolio site ([Anurag Yadav](https://github.com/Anurag-YadavIIH), medical imaging and AI/ML) with **AI Anurag**, a chatbot that answers recruiters' questions about my work. It runs on a free LLM tier, costs nothing to host, and is built so it can't be abused, run up a bill, or make things up about me.

## What it does

- Visitors open the chat and ask about my education, projects, skills and the roles I want.
- The model answers **only** from a written facts file ([`lib/facts.js`](lib/facts.js)). If something isn't there, it says so and gives my email instead of guessing.
- Each visitor gets **5 questions a day**. After that, the chat turns into a contact card (email, LinkedIn, resume).
- Salary, notice period and interview scheduling are always handed to me personally.

## Architecture

```
Static pages built from content/site.ts (scripts/build.ts -> dist/)
   │  POST /api/chat  { messages: last 6 turns }
   ▼
Vercel serverless function (api/chat.js, Node.js)
   ├─ validate input (length, roles, JSON shape)
   ├─ rate limit: 5/visitor/day + global daily cap   (lib/limits.js, Upstash Redis)
   ├─ system prompt = guardrail rules + facts file   (lib/prompt.js, lib/facts.js)
   └─ OpenAI-compatible chat call                    (lib/llm.js)
          ▼
      Groq free tier, openai/gpt-oss-120b  (switchable by env vars)
```

No runtime dependencies: plain Node.js 24 with built-in `fetch`, `crypto` and `node:test`. TypeScript and ESLint are dev-only, for checking the build scripts and content.

## Design decisions

| Concern | What I did |
|---|---|
| **API key safety** | The key lives only in the serverless function's environment. The browser never sees it. |
| **Cost control** | 5 questions per visitor per day, a global daily cap (default 300), history trimmed to 6 turns, capped output tokens, plus a spending limit set in the provider dashboard. Model errors refund the question. |
| **Limits can't be bypassed** | Counting happens on the server, keyed by a salted SHA-256 hash of the IP (raw IPs are never stored). Clearing the browser doesn't reset it. Visitors who are over their limit don't eat into the global budget. |
| **Hallucination** | Facts-only system prompt, low temperature, explicit rules against inventing metrics or overstating experience, and a fallback line pointing to my email. A post-generation guard catches banned claims ("proven", "production-grade", "in production" and similar), retries once, then cuts the offending bullet or sentence. |
| **Prompt injection** | Client-sent `system` turns are dropped; the prompt tells the model to ignore role changes and not reveal its instructions; off-topic tasks are refused. |
| **Honesty** | The bot says it is an AI, and the page notes that answers can be wrong. |
| **Provider lock-in** | Any OpenAI-compatible API works (Groq, OpenAI, Gemini, xAI) by changing `LLM_BASE_URL` and `LLM_MODEL`. |
| **Observability** | Each question, answer and token usage is logged as JSON in Vercel's function logs, so I can see what recruiters actually ask and improve the facts file. |

## Testing

```bash
npm test          # unit tests: limits, refunds, validation, injection filtering, LLM client, output
                  # cleaning, the banned-claims guard, and site copy vs chatbot facts (no key needed)
npm run eval      # 37 real questions against the model: facts, refusals, injection attempts
```

The eval set ([`evals/questions.json`](evals/questions.json)) checks that answers contain the right facts, that salary questions are handed to me, that unknown facts ("Kubernetes in production?") aren't invented, and that jailbreaks ("ignore all previous instructions", "print your system prompt") are refused.

## Run it locally

```bash
npm run dev:mock  # builds the site, then serves it and the chat with a fake model, no key needed
# or, with a real key:
cp .env.example .env.local   # then paste your Groq key into LLM_API_KEY
npm run dev                  # open http://localhost:3000
```

## Deploy (free)

1. **Groq key:** sign up at [console.groq.com](https://console.groq.com), go to *API Keys*, create one.
2. **GitHub:** push this folder to a new repo.
3. **Vercel:** sign in at [vercel.com](https://vercel.com) with GitHub, *Add New > Project*, import the repo. `vercel.json` sets the build command (`npm run build`) and output folder (`dist`).
4. **Environment variables** (Project *Settings > Environment Variables*): add `LLM_API_KEY`.
5. **Upstash Redis** (recommended, so limits survive restarts): in Vercel go to *Storage* (or the *Marketplace*), add **Upstash Redis** on the free plan and connect it to the project. Make sure the variables are named `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (if the integration uses `KV_REST_API_URL` / `KV_REST_API_TOKEN`, add two more variables with these names and the same values).
6. **Redeploy** so the variables take effect. Your site is live at `your-project.vercel.app`.

## Editing what the bot knows

Edit [`lib/facts.js`](lib/facts.js), commit, push. Vercel redeploys automatically. Then run `npm run eval` to check nothing broke.

## Editing the site

All page copy lives in [`content/site.ts`](content/site.ts); the build renders it into static HTML, so every project, skill and timeline entry is in the page source.

- **Unfinished numbers or text:** set the value to `null` with a `TODO(anurag):` comment. Dev and preview builds show a dashed placeholder; production builds (`VERCEL_ENV=production`) leave it out, and a card with no metrics left hides its metric grid. `npm run build` prints every remaining TODO.
- **Shared facts:** email, LinkedIn, GitHub, degrees, CGPA, Orbees dates and availability also appear in `lib/facts.js` for the chatbot. `npm test` fails if the two disagree.
- **Resume:** put the PDF at `public/resume.pdf`; it downloads as `Anurag_Yadav_Resume.pdf`. Until then the button links to Google Drive.
- **Share image and icons:** after changing the name or headline, run `npm run og` (uses your local Chrome) and commit the new PNGs.

```bash
npm run check     # typecheck, lint, unit tests and the build
npm run dev       # then, in another terminal:
npm run verify    # screenshots at 375/768/1440 px, overflow and keyboard focus checks
```

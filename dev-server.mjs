// Local preview without the Vercel CLI:  npm run dev   then open http://localhost:3000
// Serves the built site in dist/ (npm run dev builds it first) with clean URLs, and routes
// POST /api/chat to the same handler Vercel runs.
// npm run dev:mock  tests the whole flow without an API key.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeHandler } from "./api/chat.js";

const root = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local if present (simple KEY=value lines).
for (const f of [".env.local", ".env"]) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const mockLlm = async (messages) => ({
  answer: `(mock answer) You asked: "${messages[messages.length - 1].content}". With a real API key I would answer from Anurag's facts file.`,
  usage: null,
  model: "mock",
});

const MOCK = process.argv.includes("--mock") || Boolean(process.env.MOCK_LLM);
const handler = makeHandler(MOCK ? { llm: mockLlm } : {});
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2", ".pdf": "application/pdf", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8", ".json": "application/json" };
const dist = path.join(root, "dist");

// Like Vercel with cleanUrls: /work/ocuval serves dist/work/ocuval.html.
function resolve(pathname) {
  const p = path.join(dist, path.normalize(decodeURIComponent(pathname)));
  if (!p.startsWith(dist)) return null;
  for (const f of [p, path.join(p, "index.html"), p + ".html"]) {
    if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  return null;
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api/chat") return handler(req, res);
    let file = resolve(url.pathname);
    if (!file) {
      res.statusCode = 404;
      file = path.join(dist, "404.html");
      if (!fs.existsSync(file)) return res.end("Not found. Run npm run build first.");
    }
    res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
    if (file.endsWith("resume.pdf")) res.setHeader("Content-Disposition", 'attachment; filename="Anurag_Yadav_Resume.pdf"');
    fs.createReadStream(file).pipe(res);
  })
  .listen(process.env.PORT || 3000, () => {
    console.log(`Portfolio running at http://localhost:${process.env.PORT || 3000}${MOCK ? "  (mock LLM, no API key needed)" : ""}`);
  });

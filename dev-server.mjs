// Local preview without the Vercel CLI:  npm run dev   then open http://localhost:3000
// Serves public/ and routes POST /api/chat to the same handler Vercel runs.
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
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api/chat") return handler(req, res);
    const file = path.join(root, "public", url.pathname === "/" ? "index.html" : path.normalize(url.pathname));
    if (!file.startsWith(path.join(root, "public")) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.statusCode = 404;
      return res.end("Not found");
    }
    res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
    fs.createReadStream(file).pipe(res);
  })
  .listen(process.env.PORT || 3000, () => {
    console.log(`Portfolio running at http://localhost:${process.env.PORT || 3000}${MOCK ? "  (mock LLM, no API key needed)" : ""}`);
  });

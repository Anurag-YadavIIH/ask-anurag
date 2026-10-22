// Builds the static site into dist/:  node scripts/build.ts
// VERCEL_ENV=production leaves out unfinished metrics and copy; dev and preview
// builds show them as dashed placeholders. Prints every TODO(anurag) at the end.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { site } from "../content/site.ts";
import type { Copy, Metric } from "../content/types.ts";
import { html } from "./lib/html.ts";
import { caseStudyMain } from "./templates/case-study.ts";
import { homeMain } from "./templates/home.ts";
import { page, personJsonLd } from "./templates/layout.ts";
import type { Ctx, Mode } from "./templates/parts.ts";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, "dist");
const mode: Mode = process.env.VERCEL_ENV === "production" ? "production" : process.env.VERCEL_ENV === "preview" ? "preview" : "development";

/* ---------- guard: no em dashes anywhere in the copy ---------- */
const EM_DASH = "—";
(function findEmDashes(value: unknown, where: string) {
  if (typeof value === "string") {
    if (value.includes(EM_DASH)) throw new Error(`Em dash in content at ${where}: "${value}"`);
  } else if (Array.isArray(value)) value.forEach((v, i) => findEmDashes(v, `${where}[${i}]`));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) findEmDashes(v, `${where}.${k}`);
})(site, "site");

/* ---------- assets ---------- */
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, "js"), { recursive: true });
fs.cpSync(path.join(root, "public"), dist, { recursive: true });

const minifyCss = (css: string) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s*\n\s*/g, "")
    .replace(/\s*([{};,>])\s*/g, "$1")
    .replace(/;}/g, "}");
const css = minifyCss(fs.readFileSync(path.join(root, "src/css/site.css"), "utf8"));

function emitJs(name: string): string {
  const src = fs.readFileSync(path.join(root, "src/js", `${name}.js`), "utf8");
  const hash = createHash("sha256").update(src).digest("hex").slice(0, 8);
  const file = `${name}.${hash}.js`;
  fs.writeFileSync(path.join(dist, "js", file), src);
  return `/js/${file}`;
}
const js = { nav: emitJs("nav"), oct: emitJs("oct"), demos: emitJs("demos"), chat: emitJs("chat") };

const resumeIsFile = fs.existsSync(path.join(root, "public", site.resume.file));
const ctx: Ctx = {
  mode,
  showPlaceholders: mode !== "production",
  css,
  js,
  resume: { href: resumeIsFile ? `/${site.resume.file}` : site.resume.fallbackUrl, isFile: resumeIsFile },
  year: new Date().getFullYear(),
};

/* ---------- pages ---------- */
const pages: { path: string; file: string }[] = [];
function write(urlPath: string, file: string, content: string) {
  if (content.includes(EM_DASH)) throw new Error(`Em dash in generated ${file}`);
  const out = path.join(dist, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, content);
  if (urlPath) pages.push({ path: urlPath, file });
}

write(
  "/",
  "index.html",
  page(site, ctx, {
    path: "/",
    title: site.meta.title,
    description: site.meta.description,
    ogType: "website",
    main: homeMain(site, ctx),
    scripts: [js.oct],
    jsonLd: [personJsonLd(site)],
  }),
);

for (const p of site.work.featured) {
  write(
    `/work/${p.slug}`,
    `work/${p.slug}.html`,
    page(site, ctx, {
      path: `/work/${p.slug}`,
      title: `${p.name} case study | ${site.person.name}`,
      description: p.summary,
      ogType: "article",
      main: caseStudyMain(site, p, ctx),
      jsonLd: [personJsonLd(site)],
    }),
  );
}

write(
  "",
  "404.html",
  page(site, ctx, {
    path: "/404",
    title: `Page not found | ${site.person.name}`,
    description: site.meta.description,
    ogType: "website",
    main: html`<div class="wrap cs-hero" style="padding:4rem var(--pad) 6rem"><h1>Page not found</h1><p class="summary">That page doesn't exist. <a href="/">Go to the home page</a> or <a href="/#work">see my work</a>.</p></div>`,
  }),
);

const lastmod = new Date().toISOString().slice(0, 10);
fs.writeFileSync(
  path.join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
    .map((p) => `  <url><loc>${site.url}${p.path === "/" ? "/" : p.path}</loc><lastmod>${lastmod}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`,
);
fs.writeFileSync(path.join(dist, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);

/* ---------- report ---------- */
const todos: string[] = [];
// TODO(anurag) items live in the copy and the client code, not in the build tooling.
for (const dir of ["content", "src"]) {
  for (const file of fs.readdirSync(path.join(root, dir), { recursive: true, withFileTypes: true })) {
    if (!file.isFile()) continue;
    const full = path.join(file.parentPath, file.name);
    fs.readFileSync(full, "utf8")
      .split("\n")
      .forEach((line, i) => {
        const m = line.match(/TODO\(anurag\):\s*(.+?)\s*(?:\*\/)?$/);
        if (m) todos.push(`${path.relative(root, full).replace(/\\/g, "/")}:${i + 1}  ${m[1]}`);
      });
  }
}
if (!resumeIsFile) todos.push(`public/${site.resume.file}  add the resume PDF (the site links to Google Drive until then)`);

const nullMetrics = (ms: Metric[]) => ms.filter((m) => m.value === null).length;
const nullCopy = (cs: Copy[]) => cs.filter((c) => c === null).length;
const hidden = site.work.featured.reduce(
  (n, p) => n + nullMetrics(p.metrics) + nullMetrics(p.caseStudy.results.metrics) + nullCopy([p.caseStudy.problem, p.caseStudy.data, p.caseStudy.approach, p.caseStudy.results.intro, p.caseStudy.next]),
  0,
);

console.log(`Built ${pages.length} pages into dist/ (${mode} mode${ctx.showPlaceholders ? ", placeholders visible" : ", placeholders hidden"}).`);
console.log(`${hidden} unfinished metric or copy blocks ${ctx.showPlaceholders ? "shown as dashed placeholders" : "left out of the page"}.`);
console.log(`\nRemaining TODO(anurag) items (${todos.length}):`);
for (const t of todos) console.log(`  - ${t}`);

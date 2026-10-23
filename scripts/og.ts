// Generates the share image and icons into public/ using the local Chrome:
//   npm run og
// Re-run after changing the name or headline in content/site.ts, then commit the PNGs.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { site } from "../content/site.ts";
import { esc } from "./lib/html.ts";
import { Browser } from "./lib/chrome.ts";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pub = path.join(root, "public");
const font = (f: string) => pathToFileURL(path.join(pub, "fonts", f)).href;

// Retinal layers with three fluid pockets, in the site's fluid colours.
const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0E181E"/>
  <path d="M8 22c8-4 16 6 24 2s16-6 24-2" fill="none" stroke="#4FD1D9" stroke-width="4" stroke-linecap="round"/>
  <path d="M8 34c8-4 16 6 24 2s16-6 24-2" fill="none" stroke="#9FB2B8" stroke-width="3" stroke-linecap="round" opacity=".7"/>
  <path d="M8 46c8-3 16 4 24 1s16-4 24-1" fill="none" stroke="#E4ECEE" stroke-width="4" stroke-linecap="round"/>
  <ellipse cx="22" cy="40" rx="5" ry="3" fill="#F2B84B"/>
  <ellipse cx="38" cy="41" rx="6" ry="3.2" fill="#3FC1C9"/>
  <ellipse cx="48" cy="42" rx="3.5" ry="2.4" fill="#D45A9A"/>
</svg>
`;

function layers(width: number, height: number): string {
  const lines: string[] = [];
  const colors = ["#4FD1D9", "#2C4A55", "#7E949B", "#2C4A55", "#B4C5CA", "#2C4A55", "#E4ECEE"];
  colors.forEach((c, i) => {
    const y0 = 120 + i * 46;
    let d = `M0 ${y0}`;
    for (let x = 0; x <= width; x += 20) {
      const dip = 70 * Math.exp(-(((x - width * 0.55) / (width * 0.16)) ** 2));
      d += ` L${x} ${(y0 + Math.sin(x / 90 + i) * 6 + dip * (1 - i / 9)).toFixed(1)}`;
    }
    lines.push(`<path d="${d}" fill="none" stroke="${c}" stroke-width="${i % 2 ? 2 : 4}" stroke-linecap="round" opacity="${i % 2 ? 0.8 : 1}"/>`);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    ${lines.join("")}
    <ellipse cx="${width * 0.48}" cy="292" rx="34" ry="18" fill="#F2B84B" opacity=".9"/>
    <ellipse cx="${width * 0.56}" cy="300" rx="24" ry="14" fill="#F2B84B" opacity=".9"/>
    <ellipse cx="${width * 0.6}" cy="392" rx="70" ry="22" fill="#3FC1C9" opacity=".85"/>
    <ellipse cx="${width * 0.24}" cy="410" rx="40" ry="18" fill="#D45A9A" opacity=".85"/>
  </svg>`;
}

const ogHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:"Bricolage Grotesque";src:url(${font("bricolage-grotesque.woff2")}) format("woff2");font-weight:600 700}
@font-face{font-family:"IBM Plex Mono";src:url(${font("ibm-plex-mono-500.woff2")}) format("woff2");font-weight:500}
html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#0E181E;color:#E4ECEE}
.wrap{position:relative;width:1200px;height:630px;box-sizing:border-box;padding:64px 72px;display:flex;flex-direction:column;justify-content:space-between}
.art{position:absolute;right:-40px;top:20px;opacity:.55}
.name{font:500 26px "IBM Plex Mono";color:#4FD1D9;letter-spacing:.02em}
h1{font:700 72px/1.02 "Bricolage Grotesque";letter-spacing:-.035em;margin:0;max-width:820px;position:relative}
.foot{display:flex;justify-content:space-between;font:500 22px "IBM Plex Mono";color:#B4C5CA;position:relative}
</style></head><body><div class="wrap">
<div class="art">${layers(640, 560)}</div>
<div class="name">${esc(site.person.name)}</div>
<h1>${esc(site.hero.h1)}</h1>
<div class="foot"><span>M.Tech Ophthalmic Engineering, IIT Hyderabad</span><span>${esc(new URL(site.url).host)}</span></div>
</div></body></html>`;

const iconHtml = `<!doctype html><html><head><style>html,body{margin:0;width:180px;height:180px;background:#0E181E}svg{display:block;width:180px;height:180px}</style></head><body>${FAVICON.replace('rx="14"', 'rx="0"')}</body></html>`;

fs.writeFileSync(path.join(pub, "favicon.svg"), FAVICON);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "og-"));
const browser = await Browser.launch();
try {
  for (const [name, htmlSrc, w, h] of [
    ["og.png", ogHtml, 1200, 630],
    ["apple-touch-icon.png", iconHtml, 180, 180],
  ] as const) {
    const file = path.join(tmp, name + ".html");
    fs.writeFileSync(file, htmlSrc);
    const page = await browser.newPage();
    await page.viewport(w, h);
    await page.goto(pathToFileURL(file).href, 300);
    await page.screenshot(path.join(pub, name), false);
    console.log(`wrote public/${name} (${w}x${h})`);
  }
  console.log("wrote public/favicon.svg");
} finally {
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

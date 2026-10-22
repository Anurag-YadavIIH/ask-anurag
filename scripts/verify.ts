// Layout and keyboard checks against a running site (npm run dev first):
//   node scripts/verify.ts [baseUrl] [outDir]
// For each page and width: full-page screenshot, horizontal overflow check, and a
// keyboard-only pass (Tab through every stop, checking a visible focus style).

import path from "node:path";
import { Browser, type Page } from "./lib/chrome.ts";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "verify-out";
const PAGES = ["/", "/work/ocuval"];
const WIDTHS = [375, 768, 1440];

type Overflow = { tag: string; cls: string; right: number; text: string };
type Stop = { i: number; desc: string; visible: boolean };

async function overflow(page: Page): Promise<{ scroll: number; inner: number; offenders: Overflow[] }> {
  return page.eval(`(() => {
    const inner = document.documentElement.clientWidth;
    const offenders = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width && r.right > inner + 1 && getComputedStyle(el).position !== "fixed") {
        offenders.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 40), right: Math.round(r.right), text: (el.textContent || "").trim().slice(0, 40) });
      }
    }
    return { scroll: document.documentElement.scrollWidth, inner, offenders: offenders.slice(0, 8) };
  })()`);
}

async function tabThrough(page: Page, max = 150): Promise<Stop[]> {
  await page.eval("document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); true");
  const stops: Stop[] = [];
  let first = "";
  for (let i = 0; i < max; i++) {
    await page.press("Tab");
    const s = await page.eval<{ desc: string; visible: boolean } | null>(`(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const label = el.getAttribute("aria-label") || (el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 50) || el.id || el.getAttribute("type");
      const href = el.getAttribute("href");
      const visible = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== "none";
      return { desc: el.tagName.toLowerCase() + ": " + label + (href ? " -> " + href : ""), visible };
    })()`);
    if (!s) break;
    if (i > 0 && s.desc === first) break;
    if (i === 0) first = s.desc;
    stops.push({ i: i + 1, ...s });
  }
  return stops;
}

const browser = await Browser.launch();
let problems = 0;
try {
  for (const p of PAGES) {
    for (const w of WIDTHS) {
      const page = await browser.newPage();
      await page.viewport(w, 900, { mobile: w < 768, reducedMotion: true });
      await page.goto(base + p);
      // Scroll through once so lazy-loaded demos run, as they would for a visitor.
      await page.eval(`(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); await new Promise((r) => setTimeout(r, 400)); return true; })()`);
      const name = `${p === "/" ? "home" : p.slice(1).replace(/\//g, "-")}-${w}`;
      await page.screenshot(path.join(out, `${name}.png`));
      const o = await overflow(page);
      const ok = o.scroll <= o.inner && !o.offenders.length;
      if (!ok) problems++;
      console.log(`${name}: ${ok ? "no horizontal overflow" : `OVERFLOW scrollWidth=${o.scroll} viewport=${o.inner}`}`);
      for (const f of o.offenders) console.log(`    ${f.tag}.${f.cls} right=${f.right} "${f.text}"`);
      if (w === 1440 || w === 375) {
        const stops = await tabThrough(page);
        const hidden = stops.filter((s) => !s.visible);
        if (hidden.length) problems++;
        console.log(`  keyboard: ${stops.length} tab stops, ${hidden.length} without a visible focus style`);
        if (process.env.VERBOSE || hidden.length) for (const s of process.env.VERBOSE ? stops : hidden) console.log(`    ${s.i}. ${s.visible ? "" : "[no focus style] "}${s.desc}`);
      }
      await page.send("Page.close").catch(() => {});
    }
  }
} finally {
  await browser.close();
}
console.log(problems ? `\n${problems} problem(s) found.` : "\nAll layout and keyboard checks passed.");
process.exitCode = problems ? 1 : 0;

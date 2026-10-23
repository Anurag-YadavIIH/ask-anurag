// Synthetic retinal OCT B-scan with a fluid segmentation overlay (hero demo).
// Drag or use the slider to reveal the overlay, switch scanner styles, toggle fluid types.
//
// The scan is built from layer boundaries per column, like a real B-scan: vitreous,
// retinal layers, the RPE line and the choroid. Three fluid types are drawn the way
// they look clinically: intraretinal fluid as dark, irregular cysts inside the
// retina; subretinal fluid as a dark lens-shaped space between the retina and the
// RPE; a pigment epithelial detachment as a dome lifting the RPE. The overlay is
// vector shapes (35% fill, 1.5 CSS px outline), so the anatomy stays visible and
// edges stay crisp at any size.
//
// The pixel work starts once the page is idle and runs in small chunks that yield to
// the browser, so it never blocks input. There is no load animation.
const $ = (s) => document.querySelector(s);
const yieldToBrowser = () => (globalThis.scheduler?.yield ? globalThis.scheduler.yield() : new Promise((r) => setTimeout(r, 0)));

const RW = 720, RH = 320, CHUNK = 12;
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647), (seed - 1) / 2147483646);
const g = (t, c, w) => Math.exp(-(((t - c) / w) ** 2));
// Lens: flat underside on the RPE, tapering ends. Dome: steeper sides, rounder top.
const lens = (t, c, w, h) => { const u = (t - c) / w; return Math.abs(u) >= 1 ? 0 : h * Math.pow(1 - u * u, 1.15); };
const dome = (t, c, w, h) => { const u = (t - c) / w; return Math.abs(u) >= 1 ? 0 : h * Math.pow(1 - u * u, 0.55); };

/* ---------- layer boundaries per column ---------- */
const B = { ilm: [], nfl: [], gcl: [], ipl: [], inl: [], opl: [], elm: [], ez: [], nb: [], rpeTop: [], rpeBot: [], bm: [] };
for (let x = 0; x < RW; x++) {
  const t = (x + 0.5) / RW;
  const fov = g(t, 0.52, 0.07); // foveal pit
  const edema = 12 * g(t, 0.53, 0.075); // retina thickens over the cysts
  const srf = lens(t, 0.6, 0.075, 20);
  const ped = dome(t, 0.285, 0.045, 24);
  const bm = 238 + 6 * Math.sin(t * 2.4 + 0.4) + 2 * Math.sin(t * 9);
  const rpeTop = bm - 9 - ped, rpeBot = rpeTop + 9;
  const nb = rpeTop - srf; // photoreceptor tips, lifted off the RPE by subretinal fluid
  const ilm = 60 + 7 * Math.sin(t * 3 + 1) + 2.5 * Math.sin(t * 12) + 40 * fov - edema - srf * 0.85;
  const s = 1 - 0.85 * fov;
  const nfl = ilm + (8 + 14 * t) * s, gcl = nfl + 15 * s, ipl = gcl + 11 * s, inl = ipl + 14 * s, opl = inl + 8 * s;
  const ez = nb - 9, elm = ez - 6;
  Object.entries({ ilm, nfl, gcl, ipl, inl, opl, elm, ez, nb, rpeTop, rpeBot, bm }).forEach(([k, v]) => (B[k][x] = v));
}

/* ---------- intraretinal cysts: irregular, slightly elongated, tilted ---------- */
const CYSTS = [
  { t: 0.455, f: 0.3, rx: 7, ry: 10, rot: 0.18 },
  { t: 0.49, f: 0.6, rx: 10, ry: 15, rot: -0.12 },
  { t: 0.528, f: 0.34, rx: 8, ry: 11, rot: 0.3 },
  { t: 0.565, f: 0.64, rx: 11, ry: 14, rot: 0.06 },
  { t: 0.61, f: 0.42, rx: 6, ry: 9, rot: -0.22 },
].map((c) => {
  const x = Math.round(c.t * RW);
  const top = B.inl[x], bottom = B.elm[x];
  const ry = Math.min(c.ry, 0.42 * (bottom - top));
  // Uneven outline: a few low harmonics on the radius.
  const h = [[2, 0.09 + 0.04 * rnd(), rnd() * 6.28], [3, 0.07 + 0.03 * rnd(), rnd() * 6.28], [5, 0.04, rnd() * 6.28]];
  return { cx: x, cy: top + (bottom - top) * c.f, rx: Math.min(c.rx, ry), ry, cos: Math.cos(c.rot), sin: Math.sin(c.rot), h };
});
const radius = (c, a) => c.h.reduce((r, [k, amp, ph]) => r + amp * Math.sin(k * a + ph), 1);
// Normalised distance and boundary radius of (x, y) for a cyst.
function cystPolar(c, x, y) {
  const dx = x - c.cx, dy = y - c.cy;
  const u = (dx * c.cos + dy * c.sin) / c.rx, v = (-dx * c.sin + dy * c.cos) / c.ry;
  const a = Math.atan2(v, u);
  return [Math.hypot(u, v), radius(c, a)];
}

const vessels = Array.from({ length: 16 }, () => ({ x: rnd() * RW, r: 3 + rnd() * 6, d: rnd() }));
const raw = new Float32Array(RW * RH), val = new Float32Array(RW * RH);

/* ---------- reflectivity per pixel (before scanner noise) ---------- */
function fillColumns(x0, x1) {
  for (let x = x0; x < x1; x++) {
    const b = (k) => B[k][x];
    const near = CYSTS.filter((c) => Math.abs(x - c.cx) < c.ry * 1.6);
    for (let y = 0; y < RH; y++) {
      let v;
      if (y < b("ilm")) v = 0.03; // vitreous
      else if (y < b("nfl")) v = 0.78; // nerve fibre layer
      else if (y < b("gcl")) v = 0.46;
      else if (y < b("ipl")) v = 0.64;
      else if (y < b("inl")) v = 0.27;
      else if (y < b("opl")) v = 0.56;
      else if (y < b("elm")) v = 0.17; // outer nuclear layer
      else if (y < b("elm") + 1.6) v = 0.5;
      else if (y < b("ez")) v = 0.28;
      else if (y < b("ez") + 3) v = 0.9; // ellipsoid zone
      else if (y < b("nb")) v = 0.38;
      else if (y < b("rpeTop")) v = 0.035; // subretinal fluid: dark
      else if (y < b("rpeBot")) v = 0.97; // RPE line
      else if (y < b("bm")) v = 0.11; // under a PED: dark, a little speckle
      else {
        const depth = (y - b("bm")) / (RH - b("bm"));
        v = 0.5 * (1 - depth * 0.85); // choroid fading with depth
        for (const ve of vessels) {
          const dy = b("bm") + 12 + ve.d * 40;
          if (((x - ve.x) / (ve.r * 1.6)) ** 2 + ((y - dy) / ve.r) ** 2 < 1) { v *= 0.55; break; }
        }
      }
      if (near.length && y > b("inl") - 4 && y < b("elm")) {
        for (const c of near) {
          const [d, r] = cystPolar(c, x, y);
          if (d < r) { v = 0.025; break; } // fluid: black
          if (d < r + 0.2) v = Math.min(1, v + 0.16); // bright cyst wall
        }
      }
      raw[y * RW + x] = v;
    }
  }
}
// Soften layer edges a little, like the axial resolution of a real scan.
function softenColumns(x0, x1) {
  for (let x = x0; x < x1; x++) {
    for (let y = 0; y < RH; y++) {
      const up = raw[Math.max(0, y - 1) * RW + x], mid = raw[y * RW + x], down = raw[Math.min(RH - 1, y + 1) * RW + x];
      val[y * RW + x] = 0.25 * up + 0.5 * mid + 0.25 * down;
    }
  }
}

/* ---------- three scanner "styles": speckle, gamma, gain, horizontal smoothing, tint ---------- */
const VENDORS = [
  { noise: 1.3, gamma: 0.9, gain: 1.0, smooth: 0, tint: [1, 1, 1] },
  { noise: 0.55, gamma: 1.25, gain: 1.12, smooth: 2, tint: [1, 1, 1] },
  { noise: 1.7, gamma: 0.75, gain: 0.85, smooth: 0, tint: [1, 0.97, 0.9] },
];
const baseC = Object.assign(document.createElement("canvas"), { width: RW, height: RH });
const baseCache = new Map();

async function buildBase(vi) {
  if (baseCache.has(vi)) return baseC.getContext("2d").putImageData(baseCache.get(vi), 0, 0);
  const V = VENDORS[vi], img = new ImageData(RW, RH);
  let s2 = 11 + vi * 97;
  const r2 = () => ((s2 = (s2 * 16807) % 2147483647), (s2 - 1) / 2147483646);
  const row = new Float32Array(RW);
  for (let y = 0; y < RH; y++) {
    if (y % CHUNK === 0 && y) await yieldToBrowser();
    let rn = 0;
    for (let x = 0; x < RW; x++) {
      rn = rn * 0.55 + r2() * 0.45;
      row[x] = Math.min(1, Math.max(0, val[y * RW + x] * V.gain * (1 - (0.3 * V.noise) / 1.3 + rn * 0.9 * V.noise)));
    }
    for (let x = 0; x < RW; x++) {
      let n = row[x];
      if (V.smooth) {
        let a = 0, c = 0;
        for (let k = -V.smooth; k <= V.smooth; k++) {
          const xx = x + k;
          if (xx >= 0 && xx < RW) { a += row[xx]; c++; }
        }
        n = a / c;
      }
      n = Math.pow(Math.min(1, n), V.gamma) * 255;
      const i = (y * RW + x) * 4;
      img.data[i] = n * V.tint[0];
      img.data[i + 1] = n * V.tint[1];
      img.data[i + 2] = n * V.tint[2];
      img.data[i + 3] = 255;
    }
  }
  baseCache.set(vi, img);
  baseC.getContext("2d").putImageData(img, 0, 0);
}

/* ---------- segmentation overlay as vector shapes (source coordinates) ---------- */
// Softer class colours; the legend uses the same values (--irf, --srf, --ped in site.css).
const CLASSES = {
  1: { rgb: [226, 194, 126] }, // intraretinal fluid
  2: { rgb: [134, 207, 211] }, // subretinal fluid
  3: { rgb: [213, 156, 192] }, // pigment epithelial detachment
};
function bandPath(topKey, bottomKey, minGap = 0.6) {
  const p = new Path2D();
  let x = 0;
  while (x < RW) {
    while (x < RW && B[bottomKey][x] - B[topKey][x] < minGap) x++;
    if (x >= RW) break;
    const start = x;
    while (x < RW && B[bottomKey][x] - B[topKey][x] >= minGap) x++;
    p.moveTo(start + 0.5, B[topKey][start]);
    for (let i = start; i < x; i++) p.lineTo(i + 0.5, B[topKey][i]);
    for (let i = x - 1; i >= start; i--) p.lineTo(i + 0.5, B[bottomKey][i]);
    p.closePath();
  }
  return p;
}
CLASSES[1].path = new Path2D();
for (const c of CYSTS) {
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2, r = radius(c, a);
    const u = r * Math.cos(a) * c.rx, v = r * Math.sin(a) * c.ry;
    const px = c.cx + u * c.cos - v * c.sin, py = c.cy + u * c.sin + v * c.cos;
    if (i === 0) CLASSES[1].path.moveTo(px, py);
    else CLASSES[1].path.lineTo(px, py);
  }
  CLASSES[1].path.closePath();
}
CLASSES[2].path = bandPath("nb", "rpeTop");
CLASSES[3].path = bandPath("rpeBot", "bm");
const on = { 1: true, 2: true, 3: true };

const cv = $("#scan"), ctx = cv.getContext("2d"), range = $("#scanRange"), frame = $("#scanFrame");
let reveal = range.value / 100, ready = false;

function drawOverlay() {
  const W = cv.width, H = cv.height;
  // 1.5 CSS px outline, expressed in source units at the current display size.
  const lw = 1.5 / (frame.clientWidth / RW || 1);
  ctx.save();
  ctx.scale(W / RW, H / RH);
  ctx.lineJoin = "round";
  for (const k of [3, 2, 1]) {
    if (!on[k]) continue;
    const { rgb, path } = CLASSES[k];
    ctx.fillStyle = `rgba(${rgb},0.35)`;
    ctx.fill(path);
    ctx.strokeStyle = "rgba(4,10,14,0.85)"; // thin dark halo keeps the outline visible against the bright RPE line
    ctx.lineWidth = lw * 2.6;
    ctx.stroke(path);
    ctx.strokeStyle = `rgb(${rgb})`;
    ctx.lineWidth = lw;
    ctx.stroke(path);
  }
  ctx.restore();
}

function draw() {
  if (!ready) return;
  const W = cv.width, H = cv.height, rx = W * reveal;
  ctx.drawImage(baseC, 0, 0, W, H);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, rx, H);
  ctx.clip();
  drawOverlay();
  ctx.restore();
  if (reveal > 0.002 && reveal < 0.998) {
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.fillRect(rx - 2, 0, 4, H);
    ctx.beginPath();
    ctx.arc(rx, H / 2, 30, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.fillStyle = "#0E181E";
    ctx.beginPath(); ctx.moveTo(rx - 6, H / 2 - 11); ctx.lineTo(rx - 17, H / 2); ctx.lineTo(rx - 6, H / 2 + 11); ctx.fill();
    ctx.beginPath(); ctx.moveTo(rx + 6, H / 2 - 11); ctx.lineTo(rx + 17, H / 2); ctx.lineTo(rx + 6, H / 2 + 11); ctx.fill();
  }
}
function set(r) {
  reveal = Math.min(1, Math.max(0, r));
  range.value = Math.round(reveal * 100);
  draw();
}

let dragging = false;
range.addEventListener("input", () => set(range.value / 100));
const pos = (e) => { const r = frame.getBoundingClientRect(); return (e.clientX - r.left) / r.width; };
frame.addEventListener("pointerdown", (e) => { dragging = true; frame.setPointerCapture(e.pointerId); set(pos(e)); });
frame.addEventListener("pointermove", (e) => { if (dragging || e.pointerType === "mouse") set(pos(e)); });
frame.addEventListener("pointerup", () => (dragging = false));
frame.addEventListener("pointercancel", () => (dragging = false));
$("#vendors").addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  [...e.currentTarget.children].forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  await buildBase(+b.dataset.v);
  draw();
});
$("#legend").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const l = +b.dataset.l;
  on[l] = !on[l];
  b.setAttribute("aria-pressed", String(on[l]));
  if (reveal < 0.05) set(1);
  else draw();
});
// The outline width depends on the displayed size.
new ResizeObserver(() => draw()).observe(frame);

(async () => {
  await new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 1500 }) : setTimeout(r, 200)));
  for (let x = 0; x < RW; x += CHUNK) {
    fillColumns(x, Math.min(RW, x + CHUNK));
    await yieldToBrowser();
  }
  for (let x = 0; x < RW; x += CHUNK * 4) {
    softenColumns(x, Math.min(RW, x + CHUNK * 4));
    await yieldToBrowser();
  }
  await buildBase(0);
  ready = true;
  set(reveal);
})();

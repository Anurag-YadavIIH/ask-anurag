// Synthetic retinal OCT B-scan with a fluid segmentation overlay (hero demo).
// Drag or use the slider to reveal the overlay, switch scanner styles, toggle fluid types.
// The pixel work starts once the page is idle and runs in small chunks that yield to the
// browser, so it never blocks input. There is no load animation: the scan appears with
// the overlay revealed to the slider position.
const $ = (s) => document.querySelector(s);
const yieldToBrowser = () => (globalThis.scheduler?.yield ? globalThis.scheduler.yield() : new Promise((r) => setTimeout(r, 0)));

const RW = 720, RH = 320, ROWS_PER_CHUNK = 12;
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647), (seed - 1) / 2147483646);
const g = (t, c, w) => Math.exp(-(((t - c) / w) ** 2));

/* retinal layer boundaries per column */
const B = { ilm: [], nfl: [], gcl: [], ipl: [], inl: [], opl: [], elm: [], ez: [], nb: [], rpeTop: [], rpeBot: [], bm: [] };
for (let x = 0; x < RW; x++) {
  const t = x / RW, fov = g(t, 0.52, 0.075);
  const srf = 26 * g(t, 0.57, 0.065), ped = 22 * g(t, 0.28, 0.04);
  const bm = 238 + 6 * Math.sin(t * 2.4 + 0.4) + 2 * Math.sin(t * 9);
  const rpeTop = bm - 9 - ped, rpeBot = rpeTop + 9;
  const nb = rpeTop - srf;
  const ilm = 58 + 7 * Math.sin(t * 3 + 1) + 2.5 * Math.sin(t * 12) + 46 * fov - srf * 0.85;
  const s = 1 - 0.9 * fov;
  const nfl = ilm + (8 + 14 * t) * s, gcl = nfl + 15 * s, ipl = gcl + 11 * s, inl = ipl + 14 * s, opl = inl + 8 * s;
  const ez = nb - 9, elm = ez - 6;
  Object.entries({ ilm, nfl, gcl, ipl, inl, opl, elm, ez, nb, rpeTop, rpeBot, bm }).forEach(([k, v]) => (B[k][x] = v));
}
const cysts = [[0.45, 0.55, 16, 9], [0.49, 0.35, 11, 7], [0.505, 0.72, 20, 11], [0.555, 0.45, 13, 8], [0.6, 0.6, 10, 6], [0.42, 0.3, 7, 5]].map(([cx, f, rx, ry]) => {
  const x = Math.round(cx * RW);
  return { x, y: B.ipl[x] + (B.elm[x] - B.ipl[x]) * f, rx, ry };
});
const vessels = Array.from({ length: 16 }, () => ({ x: rnd() * RW, r: 3 + rnd() * 6, d: rnd() }));
const val = new Float32Array(RW * RH), lab = new Uint8Array(RW * RH);

function fillColumnRange(x0, x1) {
  for (let x = x0; x < x1; x++) {
    const b = (k) => B[k][x];
    for (let y = 0; y < RH; y++) {
      let v, l = 0;
      if (y < b("ilm")) v = 0.03;
      else if (y < b("nfl")) v = 0.78;
      else if (y < b("gcl")) v = 0.46;
      else if (y < b("ipl")) v = 0.64;
      else if (y < b("inl")) v = 0.27;
      else if (y < b("opl")) v = 0.56;
      else if (y < b("elm")) v = 0.17;
      else if (y < b("elm") + 1.6) v = 0.5;
      else if (y < b("ez")) v = 0.28;
      else if (y < b("ez") + 3) v = 0.9;
      else if (y < b("nb")) v = 0.38;
      else if (y < b("rpeTop")) { v = 0.04; l = 2; }
      else if (y < b("rpeBot")) v = 0.97;
      else if (y < b("bm")) { v = 0.1; l = 3; }
      else {
        const depth = (y - b("bm")) / (RH - b("bm"));
        v = 0.5 * (1 - depth * 0.85);
        for (const ve of vessels) {
          const dy = b("bm") + 12 + ve.d * 40;
          if (((x - ve.x) / (ve.r * 1.6)) ** 2 + ((y - dy) / ve.r) ** 2 < 1) { v *= 0.55; break; }
        }
      }
      if (y >= b("ipl") && y < b("elm")) {
        for (const c of cysts) {
          if (((x - c.x) / c.rx) ** 2 + ((y - c.y) / c.ry) ** 2 < 1) { v = 0.03; l = 1; break; }
        }
      }
      val[y * RW + x] = v;
      lab[y * RW + x] = l;
    }
  }
}

/* three scanner "styles": speckle, gamma, gain, horizontal smoothing, tint */
const VENDORS = [
  { noise: 1.3, gamma: 0.9, gain: 1.0, smooth: 0, tint: [1, 1, 1] },
  { noise: 0.55, gamma: 1.25, gain: 1.12, smooth: 2, tint: [1, 1, 1] },
  { noise: 1.7, gamma: 0.75, gain: 0.85, smooth: 0, tint: [1, 0.97, 0.9] },
];
const mk = () => Object.assign(document.createElement("canvas"), { width: RW, height: RH });
const baseC = mk(), overC = mk();
const baseCache = new Map();

async function buildBase(vi) {
  if (baseCache.has(vi)) return baseC.getContext("2d").putImageData(baseCache.get(vi), 0, 0);
  const V = VENDORS[vi], img = new ImageData(RW, RH);
  let s2 = 11 + vi * 97;
  const r2 = () => ((s2 = (s2 * 16807) % 2147483647), (s2 - 1) / 2147483646);
  const row = new Float32Array(RW);
  for (let y = 0; y < RH; y++) {
    if (y % ROWS_PER_CHUNK === 0 && y) await yieldToBrowser();
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

const COL = { 1: [242, 184, 75], 2: [63, 193, 201], 3: [212, 90, 154] }, on = { 1: true, 2: true, 3: true };
async function buildOver() {
  const img = new ImageData(RW, RH);
  for (let i = 0; i < RW * RH; i++) {
    if (i % (RW * ROWS_PER_CHUNK) === 0 && i) await yieldToBrowser();
    const l = lab[i];
    if (l && on[l]) {
      const c = COL[l];
      img.data[i * 4] = c[0];
      img.data[i * 4 + 1] = c[1];
      img.data[i * 4 + 2] = c[2];
      img.data[i * 4 + 3] = 150;
    }
  }
  overC.getContext("2d").putImageData(img, 0, 0);
}

const cv = $("#scan"), ctx = cv.getContext("2d"), range = $("#scanRange"), frame = $("#scanFrame");
let reveal = range.value / 100, ready = false;
function draw() {
  if (!ready) return;
  const W = cv.width, H = cv.height, rx = W * reveal;
  ctx.drawImage(baseC, 0, 0, W, H);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, rx, H);
  ctx.clip();
  ctx.drawImage(overC, 0, 0, W, H);
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
range.addEventListener("input", () => { set(range.value / 100); });
const pos = (e) => { const r = frame.getBoundingClientRect(); return (e.clientX - r.left) / r.width; };
frame.addEventListener("pointerdown", (e) => { dragging = true; frame.setPointerCapture(e.pointerId); set(pos(e)); });
frame.addEventListener("pointermove", (e) => { if (dragging || e.pointerType === "mouse") { set(pos(e)); } });
frame.addEventListener("pointerup", () => (dragging = false));
frame.addEventListener("pointercancel", () => (dragging = false));
$("#vendors").addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  [...e.currentTarget.children].forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  await buildBase(+b.dataset.v);
  draw();
});
$("#legend").addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const l = +b.dataset.l;
  on[l] = !on[l];
  b.setAttribute("aria-pressed", String(on[l]));
  await buildOver();
  if (reveal < 0.05) set(1);
  else draw();
});

(async () => {
  await new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 1500 }) : setTimeout(r, 200)));
  for (let x = 0; x < RW; x += ROWS_PER_CHUNK) {
    fillColumnRange(x, Math.min(RW, x + ROWS_PER_CHUNK));
    await yieldToBrowser();
  }
  await buildBase(0);
  await buildOver();
  ready = true;
  set(reveal);
})();

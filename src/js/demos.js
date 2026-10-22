// The two demos in #demos: BM25 portfolio search and the train/test leak demo.
// Loaded by nav.js when the section comes near the viewport.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/* ================= BM25 portfolio search ================= */
{
  const DOCS = JSON.parse($("#search-docs").textContent);
  const STOP = new Set("a an the is are was were be been of to in on for and or with by at as it his he him i me my you your what which who how does do did has have had any about this that from can tell".split(" "));
  const SYN = { cv: "vision", imaging: "imaging images image", images: "imaging image", llm: "llm genai agents", ai: "ai machine", job: "roles work", hire: "hire why", skills: "skills programming", degree: "education", college: "education", university: "education", rag: "rag retrieval", experience: "experience work", projects: "project", eye: "eye retinal ophthalmic", contact: "contact email reach", email: "contact email", gpa: "cgpa", cgpa: "cgpa education", leak: "leakage", join: "availability join", available: "availability", thesis: "thesis" };
  const stem = (w) => w.replace(/(ing|ed|es|s)$/, "");
  const tok = (s) => s.toLowerCase().replace(/[^a-z0-9+ ]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));
  const expand = (ws) => ws.flatMap((w) => (SYN[w] ? SYN[w].split(" ") : []).concat(w)).map(stem);
  const docs = DOCS.map((d) => {
    const w = tok(d.t + " " + d.t + " " + d.x).map(stem);
    const tf = {};
    w.forEach((x) => (tf[x] = (tf[x] || 0) + 1));
    return { ...d, tf, len: w.length };
  });
  const N = docs.length;
  const avg = docs.reduce((a, d) => a + d.len, 0) / N;
  const df = {};
  docs.forEach((d) => Object.keys(d.tf).forEach((k) => (df[k] = (df[k] || 0) + 1)));
  function search(q) {
    const qs = [...new Set(expand(tok(q)))];
    return docs
      .map((d) => {
        let s = 0;
        qs.forEach((t) => {
          const f = d.tf[t];
          if (!f) return;
          const idf = Math.log(1 + (N - df[t] + 0.5) / (df[t] + 0.5));
          s += (idf * f * 2.5) / (f + 1.5 * (0.25 + (0.75 * d.len) / avg));
        });
        return { d, s };
      })
      .sort((a, b) => b.s - a.s);
  }
  const ans = $("#answer");
  function run(q) {
    q = q.trim();
    if (!q) return;
    const r = search(q);
    const top = r[0];
    if (!top || top.s < 0.4) {
      ans.innerHTML = "<p>I couldn't find that in my portfolio. Try asking about my projects, education or skills, or email me directly.</p>";
      return;
    }
    const max = top.s;
    ans.innerHTML =
      `<p>${esc(top.d.x)}</p><p class="hits-label">Passages retrieved, with BM25 scores</p><ul class="hits">` +
      r.slice(0, 3).filter((h) => h.s > 0)
        .map((h) => `<li><span>${esc(h.d.t)}</span><span class="bar" aria-hidden="true"><i style="width:${((h.s / max) * 100).toFixed(0)}%"></i></span><span class="sc">${h.s.toFixed(1)}</span></li>`)
        .join("") +
      "</ul>";
  }
  const SUG = ["Has he worked with medical images?", "What is ConsultRAG?", "Where did he study?", "When can he join?", "Why should we hire him?"];
  const sug = $("#suggest");
  sug.innerHTML = SUG.map((s) => `<button type="button">${esc(s)}</button>`).join("");
  sug.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    $("#askInput").value = b.textContent;
    run(b.textContent);
  });
  $("#askForm").addEventListener("submit", (e) => {
    e.preventDefault();
    run($("#askInput").value);
  });
}

/* ================= train/test leak demo ================= */
{
  const P = 10, IMG = 4, hues = [0, 36, 60, 120, 170, 200, 230, 270, 300, 330];
  let mode = "image";
  const tr = $("#trainDots"), te = $("#testDots");
  const dot = (p, leak) =>
    `<li class="pd${leak ? " leak" : ""}" style="background:hsl(${hues[p]} 60% 38%)" title="Patient ${p + 1}${leak ? ", in both sets" : ""}">${p + 1}${leak ? '<span class="sr-only"> (in both sets)</span>' : ""}</li>`;
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function run() {
    let train = [], test = [];
    if (mode === "image") {
      const imgs = shuffle([...Array(P * IMG)].map((_, i) => Math.floor(i / IMG)));
      test = imgs.slice(0, 12);
      train = imgs.slice(12);
    } else {
      const testPatients = new Set(shuffle([...Array(P).keys()]).slice(0, 3));
      for (let p = 0; p < P; p++) for (let k = 0; k < IMG; k++) (testPatients.has(p) ? test : train).push(p);
    }
    train.sort((a, b) => a - b);
    test.sort((a, b) => a - b);
    const both = new Set(test.filter((p) => train.includes(p)));
    tr.innerHTML = train.map((p) => dot(p, both.has(p))).join("");
    te.innerHTML = test.map((p) => dot(p, both.has(p))).join("");
    [tr, te].forEach((el) => {
      el.classList.remove("flash");
      void el.offsetWidth;
      el.classList.add("flash");
    });
    const n = $("#leakNum");
    n.textContent = both.size;
    n.className = "leak-num " + (both.size ? "bad" : "good");
    $("#leakMsg").textContent = both.size
      ? "These patients (ringed) are in both sets. The model can learn to recognise the patient's eye instead of the disease, so the test score looks better than it really is."
      : "No patient appears on both sides, so the test score shows how the model does on people it has never seen. This is the honest way to split medical data.";
  }
  $("#splitMode").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    mode = b.dataset.m;
    [...e.currentTarget.children].forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    run();
  });
  $("#reshuffle").addEventListener("click", run);
  run();
}

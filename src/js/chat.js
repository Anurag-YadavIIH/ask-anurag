// "Ask AI Anurag" chat panel. Loaded on first use by nav.js; talks to /api/chat.
const ENDPOINT = "/api/chat", LIMIT = 5, STORE = "aa-chat-v1";
const SUGGESTIONS = ["What are you working on now?", "Tell me about your medical imaging work", "When can you join?", "Why should we hire you?"];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const linkify = (t) =>
  esc(t)
    .replace(/(https?:\/\/[^\s)]+[^\s).,])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/([\w.+-]+@[\w-]+\.[\w.]+)/g, '<a href="mailto:$1">$1</a>');

export function init(cfg) {
  const box = document.createElement("section");
  box.className = "chat";
  box.id = "chat";
  box.hidden = true;
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "false");
  box.setAttribute("aria-labelledby", "chatTitle");
  box.innerHTML = `
    <div class="chat-head">
      <span class="av" aria-hidden="true">AY</span>
      <div><b id="chatTitle">AI Anurag</b><small>An AI that answers from my resume</small></div>
      <button class="chat-close" type="button" aria-label="Close chat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>
    <div class="chat-log" aria-live="polite"></div>
    <div class="chat-sugs" role="group" aria-label="Suggested questions"></div>
    <div class="chat-foot">
      <form class="chat-form">
        <label for="chatInput" class="sr-only">Your question</label>
        <input id="chatInput" maxlength="500" autocomplete="off" placeholder="Ask about my projects, skills...">
        <button type="submit">Send</button>
      </form>
      <div class="chat-meta"><span class="left"></span><span>AI answers can be wrong. Questions are logged to improve answers.</span></div>
    </div>`;
  document.body.appendChild(box);

  const q = (s) => box.querySelector(s);
  const log = q(".chat-log"), form = q(".chat-form"), input = q("#chatInput"), send = q('.chat-form button'), left = q(".chat-meta .left"), sugs = q(".chat-sugs");
  const fab = document.querySelector(".chat-fab");
  let history = [], remaining = LIMIT, busy = false, started = false, opener = null;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const st = JSON.parse(localStorage.getItem(STORE) || "null");
    if (st && st.day === today) { remaining = st.remaining; history = st.history || []; }
  } catch { /* storage unavailable: start fresh */ }
  const save = () => {
    try { localStorage.setItem(STORE, JSON.stringify({ day: today, remaining, history: history.slice(-12) })); } catch { /* ignore */ }
  };

  function add(role, text) {
    const d = document.createElement("div");
    d.className = "msg " + role;
    d.innerHTML = linkify(text);
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }
  function limitCard(text) {
    const d = document.createElement("div");
    d.className = "limit-card";
    const resume = cfg.resumeIsFile
      ? `<a class="alt" href="${esc(cfg.resume)}" download="${esc(cfg.resumeName)}">Resume (PDF)</a>`
      : `<a class="alt" href="${esc(cfg.resume)}" target="_blank" rel="noopener">Resume (PDF)</a>`;
    d.innerHTML = `${esc(text || "You've used all 5 questions for today. I'd love to continue the conversation directly.")}<div class="row"><a href="mailto:${esc(cfg.email)}">Email me</a><a class="alt" href="${esc(cfg.linkedin)}" target="_blank" rel="noopener">LinkedIn</a>${resume}</div>`;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }
  function refresh() {
    left.textContent = remaining > 0 ? `${remaining} of ${LIMIT} questions left today` : "No questions left today";
    input.disabled = remaining <= 0;
    send.disabled = busy || remaining <= 0;
    sugs.hidden = history.length > 0 || remaining <= 0;
  }
  function start() {
    if (started) return;
    started = true;
    add("bot", `Hi, I'm AI Anurag, an AI version of Anurag that answers from his resume and projects. You can ask me ${LIMIT} questions a day. For anything personal, like salary or interviews, the real Anurag will reply by email.`);
    history.forEach((m) => add(m.role === "user" ? "me" : "bot", m.content));
    if (remaining <= 0) limitCard();
    sugs.innerHTML = SUGGESTIONS.map((s) => `<button type="button">${esc(s)}</button>`).join("");
    refresh();
  }
  function open(trigger) {
    opener = trigger || fab;
    start();
    box.hidden = false;
    fab?.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => (input.disabled ? q(".chat-close") : input).focus());
  }
  function close() {
    box.hidden = true;
    fab?.setAttribute("aria-expanded", "false");
    (opener && opener.isConnected && opener.offsetParent !== null ? opener : fab)?.focus();
  }
  async function ask(text) {
    text = text.trim();
    if (!text || busy || remaining <= 0) return;
    busy = true;
    input.value = "";
    add("me", text);
    history.push({ role: "user", content: text });
    refresh();
    const t = add("bot", "");
    t.innerHTML = '<span class="typing-dots" role="img" aria-label="AI Anurag is typing"><i></i><i></i><i></i></span>';
    const fail = "I couldn't connect just now. Please try again, or email me at " + cfg.email + ".";
    try {
      const r = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history.slice(-6) }) });
      let data = {};
      try { data = await r.json(); } catch { /* not JSON */ }
      if (typeof data.remaining === "number") remaining = data.remaining;
      if (r.ok && data.answer) {
        t.innerHTML = linkify(data.answer);
        history.push({ role: "assistant", content: data.answer });
      } else if (data.limit) {
        t.remove();
        history.pop();
        remaining = 0;
        limitCard(data.error);
      } else {
        t.innerHTML = linkify(data.error || fail);
        history.pop();
      }
    } catch {
      t.innerHTML = linkify(fail);
      history.pop();
    }
    busy = false;
    if (remaining <= 0 && !log.querySelector(".limit-card")) limitCard();
    save();
    refresh();
    if (!input.disabled) input.focus();
  }

  q(".chat-close").addEventListener("click", close);
  box.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  form.addEventListener("submit", (e) => { e.preventDefault(); ask(input.value); });
  sugs.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) ask(b.textContent); });
  return { open, close };
}

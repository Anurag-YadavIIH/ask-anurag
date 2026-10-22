// Runs on every page: mobile menu, copy email, and lazy loading of the chat and demos.
const cfg = JSON.parse(document.getElementById("site-config").textContent);

/* mobile menu */
const bar = document.getElementById("nav-bar");
const menuBtn = bar.querySelector(".menu-btn");
function setMenu(open) {
  bar.classList.toggle("nav-open", open);
  menuBtn.setAttribute("aria-expanded", String(open));
  menuBtn.setAttribute("aria-label", open ? "Close menu" : "Menu");
}
menuBtn.addEventListener("click", () => setMenu(!bar.classList.contains("nav-open")));
document.getElementById("nav-links").addEventListener("click", (e) => {
  if (e.target.closest("a")) setMenu(false);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && bar.classList.contains("nav-open")) {
    setMenu(false);
    menuBtn.focus();
  }
});

/* copy email, with a confirmation screen readers announce (role="status") */
const copyBtn = document.getElementById("copyEmail");
if (copyBtn) {
  const status = document.getElementById("copyStatus");
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(cfg.email);
      status.textContent = `${cfg.copiedLabel}: ${cfg.email}`;
    } catch {
      status.textContent = `Copy failed. The address is ${cfg.email}`;
    }
  });
}

/* chat: the code loads on first use, not with the page */
let chat;
const loadChat = () => (chat ||= import(cfg.chatJs).then((m) => m.init(cfg)));
document.addEventListener("click", async (e) => {
  const trigger = e.target.closest("[data-open-chat]");
  if (!trigger) return;
  e.preventDefault();
  (await loadChat()).open(trigger);
});
// Warm it up when someone is about to click.
for (const ev of ["pointerover", "focusin"]) {
  document.addEventListener(ev, (e) => {
    if (e.target.closest?.("[data-open-chat]")) loadChat();
  }, { passive: true });
}

/* demos: load their code when the section comes near the viewport */
const demos = document.getElementById("demos");
if (demos && cfg.demosJs) {
  const io = new IntersectionObserver((entries) => {
    if (entries.some((x) => x.isIntersecting)) {
      io.disconnect();
      import(cfg.demosJs);
    }
  }, { rootMargin: "600px 0px" });
  io.observe(demos);
}

// Minimal Chrome DevTools Protocol client for local tooling (OG image, screenshots,
// keyboard checks). Uses the installed Chrome and Node's built-in WebSocket, so it
// adds no dependencies. Set CHROME_PATH if Chrome isn't in a standard location.

import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };
type Listener = (params: Record<string, unknown>, sessionId?: string) => void;

export class Browser {
  private ws: WebSocket;
  private proc: ChildProcess;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private listeners: { method: string; fn: Listener }[] = [];
  private dataDir: string;

  private constructor(ws: WebSocket, proc: ChildProcess, dataDir: string) {
    this.ws = ws;
    this.proc = proc;
    this.dataDir = dataDir;
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(`${msg.error.message} (${msg.error.code})`));
        else p.resolve(msg.result);
      } else if (msg.method) {
        for (const l of this.listeners) if (l.method === msg.method) l.fn(msg.params ?? {}, msg.sessionId);
      }
    });
  }

  static async launch(): Promise<Browser> {
    const exe = CANDIDATES.find((c) => c && fs.existsSync(c));
    if (!exe) throw new Error("Chrome not found. Set CHROME_PATH.");
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cdp-"));
    const proc = spawn(exe, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${dataDir}`, "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--mute-audio"], { stdio: ["ignore", "ignore", "pipe"] });
    const wsUrl = await new Promise<string>((resolve, reject) => {
      let buf = "";
      const t = setTimeout(() => reject(new Error("Chrome did not start")), 15000);
      proc.stderr!.on("data", (d) => {
        buf += String(d);
        const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
        if (m) {
          clearTimeout(t);
          resolve(m[1]!);
        }
      });
    });
    const ws = new WebSocket(wsUrl);
    await new Promise((r, j) => {
      ws.addEventListener("open", r, { once: true });
      ws.addEventListener("error", j, { once: true });
    });
    return new Browser(ws, proc, dataDir);
  }

  send<T = Record<string, unknown>>(method: string, params: object = {}, sessionId?: string): Promise<T> {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject }));
  }

  once(method: string, sessionId: string, timeoutMs = 20000): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeoutMs);
      const l = {
        method,
        fn: (p: Record<string, unknown>, s?: string) => {
          if (s !== sessionId) return;
          clearTimeout(t);
          this.listeners = this.listeners.filter((x) => x !== l);
          resolve(p);
        },
      };
      this.listeners.push(l);
    });
  }

  async newPage(): Promise<Page> {
    const { targetId } = await this.send<{ targetId: string }>("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await this.send<{ sessionId: string }>("Target.attachToTarget", { targetId, flatten: true });
    const page = new Page(this, sessionId);
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    return page;
  }

  async close(): Promise<void> {
    try {
      await this.send("Browser.close");
    } catch {
      /* already closing */
    }
    this.ws.close();
    this.proc.kill();
    await new Promise((r) => setTimeout(r, 300));
    fs.rmSync(this.dataDir, { recursive: true, force: true, maxRetries: 3 });
  }
}

export class Page {
  private browser: Browser;
  readonly sessionId: string;
  constructor(browser: Browser, sessionId: string) {
    this.browser = browser;
    this.sessionId = sessionId;
  }
  send<T = Record<string, unknown>>(method: string, params: object = {}): Promise<T> {
    return this.browser.send<T>(method, params, this.sessionId);
  }
  async viewport(width: number, height: number, opts: { mobile?: boolean; scale?: number; reducedMotion?: boolean } = {}) {
    await this.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: opts.scale ?? 1, mobile: opts.mobile ?? false });
    if (opts.reducedMotion) await this.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  }
  async goto(url: string, settleMs = 1500) {
    const loaded = this.browser.once("Page.loadEventFired", this.sessionId);
    await this.send("Page.navigate", { url });
    await loaded;
    await this.eval("document.fonts.ready.then(() => true)");
    await new Promise((r) => setTimeout(r, settleMs));
  }
  async eval<T = unknown>(expression: string): Promise<T> {
    const r = await this.send<{ result: { value: T }; exceptionDetails?: { text: string } }>("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`Page error: ${r.exceptionDetails.text}`);
    return r.result.value;
  }
  /** Full-page PNG at the current viewport width. */
  async screenshot(file: string, fullPage = true) {
    const params: Record<string, unknown> = { format: "png" };
    if (fullPage) {
      const { cssContentSize } = await this.send<{ cssContentSize: { width: number; height: number } }>("Page.getLayoutMetrics");
      params.captureBeyondViewport = true;
      params.clip = { x: 0, y: 0, width: cssContentSize.width, height: cssContentSize.height, scale: 1 };
    }
    const { data } = await this.send<{ data: string }>("Page.captureScreenshot", params);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(data, "base64"));
  }
  async press(key: "Tab" | "Enter" | "Escape", shift = false) {
    const codes = { Tab: 9, Enter: 13, Escape: 27 };
    const base = { key, code: key, windowsVirtualKeyCode: codes[key], modifiers: shift ? 8 : 0 };
    // Enter only activates buttons and links when the key event carries its text.
    await this.send("Input.dispatchKeyEvent", { ...base, type: "keyDown", ...(key === "Enter" ? { text: "\r" } : {}) });
    await this.send("Input.dispatchKeyEvent", { ...base, type: "keyUp" });
  }
}

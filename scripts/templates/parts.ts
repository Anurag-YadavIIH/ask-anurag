import type { Copy, Metric } from "../../content/types.ts";
import { html, raw, type Html } from "../lib/html.ts";

export type Mode = "production" | "preview" | "development";

export type Ctx = {
  mode: Mode;
  /** Dev and preview show dashed placeholders; production leaves unfinished items out. */
  showPlaceholders: boolean;
  css: string;
  /** Hashed public paths of the client scripts, by name. */
  js: Record<"nav" | "oct" | "demos" | "chat", string>;
  resume: { href: string; isFile: boolean };
  year: number;
};

const svg = (body: string, extra = "") =>
  raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${extra}>${body}</svg>`);

export const icon = {
  arrowRight: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  external: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
  copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>'),
  download: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  chat: svg('<path d="M4 5h16v11H9l-5 4z"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  github: raw(
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z"/></svg>',
  ),
  linkedin: raw(
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4v11.25H3zM9.5 9.75h3.83v1.54h.05c.53-1 1.84-2.06 3.79-2.06 4.05 0 4.8 2.67 4.8 6.13V21h-4v-5.07c0-1.21-.02-2.77-1.69-2.77-1.69 0-1.95 1.32-1.95 2.68V21h-4z"/></svg>',
  ),
};

/** External link that says it opens in a new tab. */
export function extLink(label: string, href: string, cls = ""): Html {
  return html`<a href="${href}" target="_blank" rel="noopener"${cls ? raw(` class="${cls}"`) : ""}>${label}${icon.external}<span class="sr-only"> (opens in a new tab)</span></a>`;
}

/** The metrics that should render: production drops anything without a real value. */
export function visibleMetrics(metrics: Metric[], ctx: Ctx): Metric[] {
  return metrics.filter((m) => m.value !== null || ctx.showPlaceholders);
}

export function metricValue(m: Metric): Html {
  if (m.value !== null) return html`<span class="metric-value">${m.value}</span>`;
  return html`<span class="metric-value"><span class="ph">${m.placeholder}</span><span class="sr-only"> (placeholder, not measured yet)</span></span>`;
}

/** One metric as a line of text, for a card with a single metric left. */
export function metricInline(m: Metric): Html {
  if (m.value !== null && m.inline) return html`<p class="inline-metric">${m.inline}</p>`;
  const value = m.value ?? html`<span class="ph">${m.placeholder}</span><span class="sr-only"> (placeholder, not measured yet)</span>`;
  return html`<p class="inline-metric"><span>${value} ${m.label}</span></p>`;
}

export function metricGrid(metrics: Metric[], ctx: Ctx, min = 1): Html | null {
  const shown = visibleMetrics(metrics, ctx);
  if (shown.length < min) return null;
  return html`<ul class="metrics">${shown.map((m) => html`<li>${metricValue(m)}<span class="metric-label">${m.label}</span></li>`)}</ul>`;
}

/** Paragraphs for a block of copy; null means "not written yet". */
export function copyBlock(copy: Copy, ctx: Ctx, asList = false): Html | null {
  if (copy === null) return ctx.showPlaceholders ? html`<p class="ph-block">TODO(anurag): not written yet. Hidden in production.</p>` : null;
  if (asList && copy.length > 1) return html`<ul class="points">${copy.map((c) => html`<li>${c}</li>`)}</ul>`;
  return html`${copy.map((c) => html`<p>${c}</p>`)}`;
}

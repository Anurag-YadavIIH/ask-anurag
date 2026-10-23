// Tagged template for HTML. Every interpolated value is escaped unless it is
// already Html (from another html`` call or raw()), so copy from content/site.ts
// can never inject markup.

export class Html {
  readonly value: string;
  constructor(value: string) {
    this.value = value;
  }
  toString(): string {
    return this.value;
  }
}

export type Part = Html | string | number | boolean | null | undefined | Part[];

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c] ?? c);

function render(p: Part): string {
  if (p === null || p === undefined || p === false || p === true) return "";
  if (Array.isArray(p)) return p.map(render).join("");
  if (p instanceof Html) return p.value;
  return esc(String(p));
}

export function html(strings: TemplateStringsArray, ...parts: Part[]): Html {
  let out = strings[0] ?? "";
  parts.forEach((p, i) => {
    out += render(p) + (strings[i + 1] ?? "");
  });
  return new Html(out);
}

/** Trusted markup or JSON that must not be escaped. */
export const raw = (s: string): Html => new Html(s);

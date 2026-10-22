import type { Site } from "../../content/types.ts";
import { html, raw, type Html } from "../lib/html.ts";
import { icon, type Ctx } from "./parts.ts";

type PageOpts = {
  path: string;
  title: string;
  description: string;
  ogType: "website" | "article";
  main: Html;
  /** Extra module scripts for this page (hashed paths). */
  scripts?: string[];
  jsonLd?: object[];
};

/** JSON for a <script> tag, with "<" escaped so it can't close the tag. */
const scriptJson = (data: unknown) => raw(JSON.stringify(data).replace(/</g, "\\u003c"));

export function personJsonLd(site: Site): object {
  const { person, education } = site;
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: person.name,
    url: site.url,
    jobTitle: person.jobTitle,
    email: `mailto:${person.email}`,
    alumniOf: [
      { "@type": "CollegeOrUniversity", name: "Indian Institute of Technology Hyderabad", alternateName: education.masters.school },
      { "@type": "CollegeOrUniversity", name: education.bachelors.school },
    ],
    knowsAbout: ["Medical image analysis", "OCT segmentation", "Retinal imaging", "Retrieval-augmented generation", "Python"],
    sameAs: [person.linkedin, person.github],
  };
}

function resumeLink(site: Site, ctx: Ctx): Html {
  const label = html`Resume<span class="long"> (PDF)</span>`;
  if (ctx.resume.isFile) {
    return html`<a class="btn btn-primary resume-btn" href="${ctx.resume.href}" download="${site.resume.downloadName}">${icon.download}${label}</a>`;
  }
  return html`<a class="btn btn-primary resume-btn" href="${ctx.resume.href}" target="_blank" rel="noopener">${icon.download}${label}<span class="sr-only"> (opens in a new tab)</span></a>`;
}

export function page(site: Site, ctx: Ctx, o: PageOpts): string {
  const canonical = site.url + (o.path === "/" ? "/" : o.path);
  const ogImage = `${site.url}/og.png`;
  const config = {
    email: site.person.email,
    linkedin: site.person.linkedin,
    resume: ctx.resume.href,
    resumeIsFile: ctx.resume.isFile,
    resumeName: site.resume.downloadName,
    chatJs: ctx.js.chat,
    demosJs: ctx.js.demos,
    copiedLabel: site.contact.copiedLabel,
  };

  const doc = html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${o.title}</title>
<meta name="description" content="${o.description}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#0E181E">
<meta name="color-scheme" content="dark">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="${o.ogType}">
<meta property="og:site_name" content="${site.person.name}">
<meta property="og:title" content="${o.title}">
<meta property="og:description" content="${o.description}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${site.meta.ogAlt}">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${o.title}">
<meta name="twitter:description" content="${o.description}">
<meta name="twitter:image" content="${ogImage}">
<meta name="twitter:image:alt" content="${site.meta.ogAlt}">
<link rel="preload" href="/fonts/bricolage-grotesque.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/ibm-plex-sans.woff2" as="font" type="font/woff2" crossorigin>
<script>document.documentElement.classList.add("js")</script>
<style>${raw(ctx.css)}</style>
${(o.jsonLd ?? []).map((d) => html`<script type="application/ld+json">${scriptJson(d)}</script>`)}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap" id="nav-bar">
    <a class="brand" href="/">${site.person.name}</a>
    <nav aria-label="Main">
      <ul class="nav-links" id="nav-links">
        ${site.nav.map((l) => html`<li><a href="${l.href}">${l.label}</a></li>`)}
      </ul>
    </nav>
    <button class="btn menu-btn" type="button" aria-expanded="false" aria-controls="nav-links" aria-label="Menu">${icon.menu}</button>
    ${resumeLink(site, ctx)}
  </div>
</header>
<main id="main" tabindex="-1">
${o.main}
</main>
<footer class="site-footer">
  <div class="wrap">
    <p>&copy; ${ctx.year} ${site.person.name}</p>
    <p>${site.footer.note}</p>
  </div>
</footer>
<button class="chat-fab" type="button" data-open-chat aria-haspopup="dialog" aria-expanded="false" aria-controls="chat"><span class="av" aria-hidden="true">AY</span><span class="lbl">Ask AI Anurag</span><span class="sr-only"> (opens a chat with an AI that answers from my resume)</span></button>
<script type="application/json" id="site-config">${scriptJson(config)}</script>
<script type="module" src="${ctx.js.nav}"></script>
${(o.scripts ?? []).map((s) => html`<script type="module" src="${s}"></script>`)}
${ctx.mode === "production" ? raw('<script defer src="/_vercel/insights/script.js"></script>') : ""}
</body>
</html>
`;
  return doc.value;
}

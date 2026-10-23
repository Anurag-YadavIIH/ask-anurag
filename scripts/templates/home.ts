import type { FeaturedProject, Site } from "../../content/types.ts";
import { html, raw, type Html } from "../lib/html.ts";
import { extLink, icon, metricGrid, metricInline, metricValue, visibleMetrics, type Ctx } from "./parts.ts";

function hero(site: Site): Html {
  const { hero: h, availability: a, person } = site;
  return html`<section class="hero" aria-labelledby="hero-title">
  <div class="wrap">
    <div>
      <p class="pill"><span class="dot" aria-hidden="true"></span>${a.status} · ${a.location} · ${a.workModes}</p>
      <h1 id="hero-title">${h.h1}</h1>
      <p class="subline">${h.subline}</p>
      <div class="ctas">
        <a class="btn btn-primary" href="${h.primaryCta.href}">${h.primaryCta.label}${icon.arrowRight}</a>
        <a class="btn" href="mailto:${person.email}">${icon.mail}${h.secondaryCta}</a>
        <button class="btn btn-text" type="button" data-open-chat aria-haspopup="dialog">${icon.chat}${h.askAi}</button>
      </div>
    </div>
    <figure class="scan" id="oct-demo">
      <div class="scan-frame" id="scanFrame">
        <canvas id="scan" width="1440" height="640" role="img" aria-label="Synthetic retinal OCT B-scan with a fluid segmentation overlay. Use the slider below to reveal the overlay."></canvas>
        <span class="scan-tag" aria-hidden="true">Retinal OCT B-scan, synthetic</span>
      </div>
      <div class="scan-controls">
        <div class="seg" role="group" aria-label="Scanner style" id="vendors">
          <button type="button" aria-pressed="true" data-v="0">Scanner A</button>
          <button type="button" aria-pressed="false" data-v="1">Scanner B</button>
          <button type="button" aria-pressed="false" data-v="2">Scanner C</button>
        </div>
        <div class="range-wrap">
          <label for="scanRange" class="sr-only">Reveal segmentation, percent of the scan</label>
          <input type="range" id="scanRange" min="0" max="100" value="62">
        </div>
      </div>
      <figcaption>${h.scanCaption}
        <ul class="legend" id="legend" aria-label="Fluid types shown">
          <li><button type="button" aria-pressed="true" data-l="1"><span class="sw sw-irf" aria-hidden="true"></span>Intraretinal fluid</button></li>
          <li><button type="button" aria-pressed="true" data-l="2"><span class="sw sw-srf" aria-hidden="true"></span>Subretinal fluid</button></li>
          <li><button type="button" aria-pressed="true" data-l="3"><span class="sw sw-ped" aria-hidden="true"></span>Pigment epithelial detachment</button></li>
        </ul>
      </figcaption>
    </figure>
  </div>
</section>`;
}

function credentials(site: Site): Html {
  return html`<section class="creds" aria-label="Credentials">
  <ul>${site.credentials.map((c) => html`<li><strong>${c.title}</strong><span>${c.detail}</span></li>`)}</ul>
</section>`;
}

function projectLinks(p: FeaturedProject): Html {
  return html`<div class="links">
    <a href="/work/${p.slug}">Read the case study${icon.arrowRight}</a>
    ${extLink(p.repo.label, p.repo.href)}
    ${p.extraLinks.map((l) => extLink(l.label, l.href))}
  </div>`;
}

function projectHead(p: FeaturedProject): Html {
  return html`<p class="tag">${p.tag}</p>
    <h3>${p.title}</h3>
    <p class="summary">${p.summary}</p>
    <ul class="chips" aria-label="Tech">${p.tech.map((t) => html`<li>${t}</li>`)}</ul>`;
}

function work(site: Site, ctx: Ctx): Html {
  const [lead, ...rest] = site.work.featured;
  if (!lead) return html``;
  // A grid only makes sense with 2+ metrics; a single one reads better as a line in the card.
  const grid = metricGrid(lead.metrics, ctx, 2);
  const shown = visibleMetrics(lead.metrics, ctx);
  const single = !grid && shown.length === 1 ? shown[0] : undefined;
  return html`<section class="section" id="work" aria-labelledby="work-title">
  <div class="wrap">
    <p class="eyebrow">Selected work</p>
    <h2 id="work-title">${site.work.heading}</h2>
    ${site.work.intro ? html`<p class="intro">${site.work.intro}</p>` : ""}
    <div class="featured${grid ? " has-metrics" : ""}">
      <article class="card">${projectHead(lead)}${single ? metricInline(single) : ""}${projectLinks(lead)}</article>
      ${grid ? html`<div aria-label="${lead.name} metrics" role="group">${grid}</div>` : ""}
    </div>
    <div class="pair">
      ${rest.map((p) => {
        const m = visibleMetrics(p.metrics, ctx)[0];
        return html`<article class="card">
        ${projectHead(p)}
        ${m ? html`<p class="headline-metric">${metricValue(m)}<span class="metric-label">${m.label}</span></p>` : ""}
        ${projectLinks(p)}
      </article>`;
      })}
    </div>
  </div>
</section>`;
}

function demos(site: Site): Html {
  const d = site.demos;
  return html`<section class="section" id="demos" aria-labelledby="demos-title">
  <div class="wrap">
    <p class="eyebrow">Demos</p>
    <h2 id="demos-title">${d.heading}</h2>
    <p class="intro">${d.intro}</p>
    <div class="play">
      <div class="panel" id="leak-demo">
        <h3>${d.leak.title}</h3>
        <p class="how">${d.leak.blurb}</p>
        <div class="seg" role="group" aria-label="Split method" id="splitMode">
          <button type="button" aria-pressed="true" data-m="image">Split by image</button>
          <button type="button" aria-pressed="false" data-m="patient">Split by patient</button>
        </div>
        <div class="leak-boxes">
          <div class="box"><h4 id="train-label">Train</h4><ul class="dots" id="trainDots" aria-labelledby="train-label"></ul></div>
          <div class="box"><h4 id="test-label">Test</h4><ul class="dots" id="testDots" aria-labelledby="test-label"></ul></div>
        </div>
        <div aria-live="polite">
          <p class="leak-read"><span class="leak-num" id="leakNum">0</span><span>patients in both train and test</span></p>
          <p class="leak-msg" id="leakMsg"></p>
        </div>
        <button class="btn" id="reshuffle" type="button">Reshuffle</button>
      </div>
      <div class="panel" id="search-demo">
        <h3>${d.search.title}</h3>
        <p class="how">${d.search.blurb} For a real conversation, <button class="link-btn" type="button" data-open-chat aria-haspopup="dialog">ask AI Anurag</button>.</p>
        <form class="ask-row" id="askForm" role="search">
          <label for="askInput" class="sr-only">Search my portfolio</label>
          <input id="askInput" type="search" placeholder="e.g. Has he worked with medical images?" autocomplete="off">
          <button class="btn btn-primary" type="submit">Search</button>
        </form>
        <div class="suggest" id="suggest" aria-label="Example questions" role="group"></div>
        <div class="answer" id="answer" aria-live="polite"><p class="empty">Pick an example above or type your own question.</p></div>
      </div>
    </div>
  </div>
  <script type="application/json" id="search-docs">${raw(JSON.stringify(site.searchDocs).replace(/</g, "\\u003c"))}</script>
</section>`;
}

function more(site: Site): Html {
  const m = site.more;
  return html`<section class="section" id="more" aria-labelledby="more-title">
  <div class="wrap">
    <h2 id="more-title">${m.heading}</h2>
    <ul class="rows">
      ${m.projects.map(
        (p) => html`<li>
        <h3><a href="${p.repo}" target="_blank" rel="noopener">${p.title}${icon.external}<span class="sr-only"> (code on GitHub, opens in a new tab)</span></a></h3>
        <p>${p.line}</p>
        <p class="stack-line">${p.stack}</p>
      </li>`,
      )}
    </ul>
    <a class="all-link" href="${m.allLink.href}" target="_blank" rel="noopener">${m.allLink.label} →<span class="sr-only"> (opens in a new tab)</span></a>
  </div>
</section>`;
}

function about(site: Site): Html {
  const a = site.about;
  return html`<section class="section" id="about" aria-labelledby="about-title">
  <div class="wrap story">
    <div class="prose">
      <p class="eyebrow">About</p>
      <h2 id="about-title">${a.heading}</h2>
      ${a.paragraphs.map((p) => html`<p>${p}</p>`)}
    </div>
    <ol class="timeline" aria-label="Timeline, newest first">
      ${a.timeline.map(
        (t) => html`<li${t.now ? raw(' class="now"') : ""}>
        <span class="when">${t.when}</span>
        <h3>${t.title}</h3>
        <p>${t.body}</p>
      </li>`,
      )}
    </ol>
  </div>
</section>`;
}

function stack(site: Site): Html {
  return html`<section class="section" id="stack" aria-labelledby="stack-title">
  <div class="wrap">
    <h2 id="stack-title">${site.stack.heading}</h2>
    <div class="stack-groups">
      ${site.stack.groups.map((g) => html`<div><h3>${g.name}</h3><p>${g.items.join(", ")}</p></div>`)}
    </div>
  </div>
</section>`;
}

function contact(site: Site): Html {
  const { contact: c, person } = site;
  return html`<section class="section contact" id="contact" aria-labelledby="contact-title">
  <div class="wrap">
    <h2 id="contact-title">${c.heading}</h2>
    <p class="intro">${c.intro}</p>
    <p class="email-line"><a href="mailto:${person.email}" id="email-text">${person.email}</a></p>
    <div class="contact-row">
      <button class="btn btn-primary" type="button" id="copyEmail">${icon.copy}${c.copyLabel}</button>
      <a class="btn" href="mailto:${person.email}">${icon.mail}Email</a>
      <a class="btn" href="${person.linkedin}" target="_blank" rel="noopener">${icon.linkedin}LinkedIn<span class="sr-only"> (opens in a new tab)</span></a>
      <a class="btn" href="${person.github}" target="_blank" rel="noopener">${icon.github}GitHub<span class="sr-only"> (opens in a new tab)</span></a>
    </div>
    <p class="copy-status" id="copyStatus" role="status"></p>
  </div>
</section>`;
}

export function homeMain(site: Site, ctx: Ctx): Html {
  return html`${hero(site)}
${credentials(site)}
${work(site, ctx)}
${demos(site)}
${more(site)}
${about(site)}
${stack(site)}
${contact(site)}`;
}

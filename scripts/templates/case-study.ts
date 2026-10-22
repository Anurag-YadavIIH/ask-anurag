import type { FeaturedProject, Site } from "../../content/types.ts";
import { html, type Html } from "../lib/html.ts";
import { copyBlock, extLink, metricGrid, type Ctx } from "./parts.ts";

function part(id: string, title: string, body: Html | null): Html | null {
  if (!body) return null;
  return html`<section aria-labelledby="${id}"><h2 id="${id}">${title}</h2>${body}</section>`;
}

export function caseStudyMain(site: Site, p: FeaturedProject, ctx: Ctx): Html {
  const cs = p.caseStudy;
  const resultsIntro = copyBlock(cs.results.intro, ctx);
  const resultsGrid = metricGrid(cs.results.metrics, ctx);
  const results = resultsIntro || resultsGrid ? html`${resultsIntro}${resultsGrid}` : null;
  const others = site.work.featured.filter((x) => x.slug !== p.slug);

  return html`<div class="wrap">
  <p class="crumbs"><a href="/#work">← All work</a></p>
  <header class="cs-hero">
    <p class="tag">${p.tag}</p>
    <h1>${p.title}</h1>
    <p class="summary">${p.summary}</p>
    <ul class="chips" aria-label="Tech">${p.tech.map((t) => html`<li>${t}</li>`)}</ul>
  </header>
  <div class="cs-body">
    ${part("problem", "Problem", copyBlock(cs.problem, ctx))}
    ${part("data", "Data", copyBlock(cs.data, ctx))}
    ${part("approach", "Approach", copyBlock(cs.approach, ctx, true))}
    ${part("results", "Results", results)}
    ${part("next", "What I'd do next", copyBlock(cs.next, ctx))}
    <section aria-labelledby="links">
      <h2 id="links">Links</h2>
      <ul class="cs-links">
        <li>${extLink(p.repo.label, p.repo.href)}</li>
        ${p.extraLinks.map((l) => html`<li>${extLink(l.label, l.href)}</li>`)}
        ${others.map((o) => html`<li><a href="/work/${o.slug}">${o.name} case study</a></li>`)}
        <li><a href="/#contact">Contact me</a></li>
      </ul>
    </section>
  </div>
</div>`;
}

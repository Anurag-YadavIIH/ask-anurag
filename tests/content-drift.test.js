// The site copy (content/site.ts) and the chatbot's facts (lib/facts.js) are kept
// separately. These tests fail when a shared fact is changed in one but not the other.
import { test } from "node:test";
import assert from "node:assert/strict";
import { site } from "../content/site.ts";
import { FACTS } from "../lib/facts.js";

const noSlash = (u) => u.replace(/\/+$/, "");
const factLine = (label) => {
  const m = FACTS.match(new RegExp(`^- ${label}: (.+)$`, "m"));
  assert.ok(m, `lib/facts.js has no "- ${label}:" line`);
  return m[1].trim();
};
const { masters, bachelors } = site.education;

test("email, LinkedIn and GitHub match", () => {
  assert.equal(factLine("Email"), site.person.email);
  assert.equal(noSlash(factLine("LinkedIn")), noSlash(site.person.linkedin));
  assert.equal(noSlash(factLine("GitHub")), noSlash(site.person.github));
});

test("degree names, schools, dates and CGPA match", () => {
  assert.ok(
    FACTS.includes(`- ${masters.degree}, ${masters.school}, ${masters.years}. CGPA ${masters.cgpa}.`),
    `facts should contain "- ${masters.degree}, ${masters.school}, ${masters.years}. CGPA ${masters.cgpa}."`,
  );
  assert.ok(
    FACTS.includes(`- ${bachelors.degree}, ${bachelors.school}, graduated ${bachelors.years}.`),
    `facts should contain "- ${bachelors.degree}, ${bachelors.school}, graduated ${bachelors.years}."`,
  );
});

test("Orbees role and dates match, including the timeline label", () => {
  const { role, org, start, end } = site.internship;
  assert.ok(FACTS.includes(`- ${role}, ${org}, ${start} to ${end}.`), `facts should contain "${role}, ${org}, ${start} to ${end}."`);
  const [startMonth, year] = start.split(" ");
  const endMonth = end.split(" ")[0];
  const entry = site.about.timeline.find((t) => t.title.includes(org));
  assert.ok(entry, "timeline has no Orbees entry");
  assert.equal(entry.when, `${startMonth.slice(0, 3)} to ${endMonth.slice(0, 3)} ${year}`);
});

test("availability line matches the hero pill", () => {
  const line = factLine("Availability").toLowerCase();
  const { status, location, workModes } = site.availability;
  if (status === "Available now") assert.match(line, /available to join immediately/);
  assert.match(line, new RegExp(`based in ${location.toLowerCase()}`));
  for (const mode of workModes.toLowerCase().split(/\s+or\s+|,\s*/)) assert.match(line, new RegExp(mode));
});

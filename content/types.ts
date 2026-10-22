// Shapes for everything in content/site.ts. The build renders these to HTML.

export type Link = { label: string; href: string };

/**
 * A number shown on a project card or case study.
 * value null means "not measured yet": production builds leave the metric out,
 * dev and preview builds show `placeholder` with a dashed outline.
 */
export type Metric = {
  label: string;
  value: string | null;
  placeholder: string;
  /**
   * Sentence used when this is the only metric left on a featured card, e.g.
   * "Data from 3 scanner vendors: Cirrus, Spectralis, Topcon". Must contain the value.
   */
  inline?: string;
};

/** A block of case-study copy. null means "not written yet" and follows the same rule as Metric. */
export type Copy = string[] | null;

export type CaseStudy = {
  problem: Copy;
  data: Copy;
  approach: Copy;
  results: { intro: Copy; metrics: Metric[] };
  next: Copy;
};

export type FeaturedProject = {
  slug: string;
  tag: string;
  title: string;
  /** Short name used in headings and links, e.g. "OcuVal". */
  name: string;
  summary: string;
  tech: string[];
  repo: Link;
  extraLinks: Link[];
  metrics: Metric[];
  caseStudy: CaseStudy;
};

export type MoreProject = {
  title: string;
  line: string;
  stack: string;
  repo: string;
};

export type Degree = {
  degree: string;
  school: string;
  /** As written in lib/facts.js, e.g. "2023 to 2025" or "2021". */
  years: string;
  cgpa?: string;
};

export type TimelineEntry = {
  when: string;
  title: string;
  body: string;
  now?: boolean;
};

export type Site = {
  url: string;
  person: {
    name: string;
    email: string;
    jobTitle: string;
    linkedin: string;
    github: string;
  };
  resume: {
    /** Path of the PDF inside public/. Used when the file exists. */
    file: string;
    downloadName: string;
    /** Used until the PDF is added. */
    fallbackUrl: string;
  };
  availability: {
    status: string;
    location: string;
    workModes: string;
  };
  education: { masters: Degree; bachelors: Degree };
  internship: { role: string; org: string; start: string; end: string; summary: string };
  meta: { title: string; description: string; ogAlt: string };
  nav: Link[];
  hero: { h1: string; subline: string; primaryCta: Link; secondaryCta: string; askAi: string; scanCaption: string };
  credentials: { title: string; detail: string }[];
  work: { heading: string; intro: string; featured: FeaturedProject[] };
  demos: { heading: string; intro: string; leak: { title: string; blurb: string }; search: { title: string; blurb: string } };
  more: { heading: string; projects: MoreProject[]; allLink: Link };
  about: { heading: string; paragraphs: string[]; timeline: TimelineEntry[] };
  stack: { heading: string; groups: { name: string; items: string[] }[] };
  contact: { heading: string; intro: string; copyLabel: string; copiedLabel: string };
  footer: { note: string };
  /** Passages for the in-browser BM25 search demo. */
  searchDocs: { t: string; x: string }[];
};

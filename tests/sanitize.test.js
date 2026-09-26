// Unit tests for cleaning model output: run with  npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeText, chatCompletion } from "../lib/llm.js";

test("em dash becomes a comma, with any spaces around it", () => {
  assert.equal(sanitizeText("Yes\u2014I work with DICOM"), "Yes, I work with DICOM");
  assert.equal(sanitizeText("the RETOUCH challenge \u2014 Cirrus"), "the RETOUCH challenge, Cirrus");
});

test("em dash next to other punctuation leaves no ', ,' behind", () => {
  assert.equal(sanitizeText("Hyderabad,\u2014 which"), "Hyderabad, which");
  assert.equal(sanitizeText("in progress. \u2014Final"), "in progress. Final");
  assert.equal(sanitizeText("\u2014 first item\n  \u2014 nested"), "- first item\n  - nested");
});

test("en dash becomes a hyphen", () => {
  assert.equal(sanitizeText("Aug\u2013Oct 2025"), "Aug-Oct 2025");
});

test("non-breaking and other Unicode hyphens become a hyphen", () => {
  assert.equal(sanitizeText("Anurag\u2011YadavIIH"), "Anurag-YadavIIH");
  assert.equal(sanitizeText("2023\u20112025 \u2010 \u2012 \u2212"), "2023-2025 - - -");
});

test("no-break, narrow and other Unicode spaces become a normal space", () => {
  assert.equal(sanitizeText("IIT\u202FHyderabad"), "IIT Hyderabad");
  assert.equal(sanitizeText("CGPA\u00A09.18\u2009here\u3000now"), "CGPA 9.18 here now");
});

test("zero-width characters are removed", () => {
  assert.equal(sanitizeText("rites\u200Bh.anurag325@gmail.com"), "ritesh.anurag325@gmail.com");
  assert.equal(sanitizeText("\uFEFFa\u200Cb\u200Dc\u2060d"), "abcd");
});

test("curly quotes and apostrophes become straight", () => {
  assert.equal(sanitizeText("I don\u2019t have \u2018that\u2019"), "I don't have 'that'");
  assert.equal(sanitizeText("\u201CAI Anurag\u201D"), '"AI Anurag"');
});

test("double spaces collapse but line breaks and list indentation stay", () => {
  assert.equal(sanitizeText("Hello  there\u00A0 friend"), "Hello there friend");
  assert.equal(sanitizeText("Skills:  \n  - Python  \n  - PyTorch"), "Skills:\n  - Python\n  - PyTorch");
});

test("llm client returns sanitized answers", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: " Email rites\u200Bh.anurag325@gmail.com\u2014thanks " } }] }),
  });
  const out = await chatCompletion([], { fetchImpl, env: { LLM_API_KEY: "k" } });
  assert.equal(out.answer, "Email ritesh.anurag325@gmail.com, thanks");
});

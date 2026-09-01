import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("the demo leads with the official integration layer and retains both growth hooks", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  assert.match(html, /Every experience already has an integrator/);
  assert.match(html, /Make it official\./);
  assert.match(html, /From scattered touchpoints to one official experience\./);
  assert.match(html, /The customer becomes the accidental integrator\./);
  assert.match(html, /One official, organizer-governed experience\./);
  assert.match(html, /One trusted path\. Two growth hooks\./);
  assert.match(html, /Your achievement, visible from the start/);
  assert.match(html, /Satisfaction hook · Verified achievement/);
  assert.match(html, /aggregated and non-identifying/i);
  const visibleText = html.replace(/<[^>]*>/g, " ");
  assert.doesNotMatch(visibleText, /\b(prize|reward|rewards)\b/i);
  assert.match(html, /The human mind has always had limits\. Until now\./);
});

test("the recording script is concise and states the evidence boundary", async () => {
  const markdown = await readFile(new URL("VIDEO_SCRIPT.md", root), "utf8");
  const narration = markdown
    .split("## Exact narration")[1]
    .split("## Pronunciation")[0]
    .trim();
  const words = narration.split(/\s+/).filter(Boolean);
  assert.ok(words.length <= 380, `Narration has ${words.length} words; expected at most 380.`);
  assert.match(narration, /Every experience already has an integrator/i);
  assert.match(narration, /usually the customer/i);
  assert.match(narration, /official and sponsor-enabled experience layer/i);
  assert.match(narration, /more accurate understanding of customer intent than impressions alone/i);
  assert.match(narration, /does not claim perfect prediction/i);
  assert.match(narration, /Ready Pass is the satisfaction hook/i);
  assert.match(narration, /aggregated and non-identifying/i);
  assert.match(narration, /no identity, contact data, or personal progress is shared/i);
  assert.doesNotMatch(narration, /\b(prize|reward|rewards)\b/i);
  assert.match(narration, /One experience\. One official truth\./);
});

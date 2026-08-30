import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("the demo leads with customer experience and the dual hook", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  assert.match(html, /One customer experience\. Two growth hooks\./);
  assert.match(html, /Hook 01 · Event virality/);
  assert.match(html, /Hook 02 · Sponsor accuracy/);
  assert.match(html, /Prize visible from the start/);
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
  assert.match(narration, /more accurate understanding of customer intent than impressions alone/i);
  assert.match(narration, /does not claim perfect prediction/i);
  assert.match(narration, /Human intent\. Agent execution\. Customer value\. Verified growth\./);
});

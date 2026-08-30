import assert from "node:assert/strict";
import test from "node:test";

import { sampleGeneratedDraft } from "../src/demo-data.js";
import { GuideStore } from "../src/guide-store.js";
import { buildSiteTools } from "../src/site-tools.js";

test("initial state is one action away from a readiness reward", () => {
  const store = new GuideStore();
  assert.deepEqual(store.progress(), { completed: 4, total: 8, percent: 50 });
  assert.deepEqual(store.readiness(), {
    completed: 4,
    total: 5,
    percent: 80,
    status: "in_progress",
    rewardStatus: "locked",
  });
});

test("outcome state keeps the next action and open loops explicit", () => {
  const store = new GuideStore();
  const outcome = store.outcomeState();
  assert.equal(outcome.currentPhase, "before");
  assert.equal(outcome.nextBestAction.id, "bike-safety");
  assert.equal(outcome.openLoops.length, 4);
  assert.ok(outcome.definitionOfDone.includes("verified"));
});

test("a personal plan changes only the personal layer", () => {
  const store = new GuideStore();
  const before = store.getState();
  const result = store.createPersonalPlan({
    availableMinutes: 25,
    experience: "first-time",
    accessibilityNeeds: "Concise instructions",
    includeSponsored: false,
  });
  const after = store.getState();
  assert.equal(result.status, "created");
  assert.ok(result.actionIds.includes("bike-safety"));
  assert.equal(result.officialGuideChanged, false);
  assert.equal(after.guide.version, before.guide.version);
  assert.deepEqual(after.guide.actions, before.guide.actions);
  assert.equal(after.participant.availableMinutes, 25);
});

test("the last preparation action unlocks the reward and undo restores the lock", () => {
  const store = new GuideStore();
  const result = store.completeAction("bike-safety");
  assert.equal(result.status, "completed");
  assert.equal(result.rewardUnlocked, true);
  assert.equal(store.readiness().percent, 100);
  assert.equal(store.getState().reward.status, "available");

  const undone = store.undoLastMutation();
  assert.equal(undone.status, "undone");
  assert.equal(store.readiness().percent, 80);
  assert.equal(store.getState().reward.status, "locked");
});

test("a readiness reward cannot be claimed early and creates a clean referral when earned", () => {
  const store = new GuideStore();
  assert.throws(() => store.claimReadinessReward(), /Complete every required Before action/);
  store.completeAction("bike-safety");
  const claimed = store.claimReadinessReward();
  assert.equal(claimed.status, "claimed");
  assert.equal(claimed.reward.status, "claimed");
  assert.equal(claimed.reward.code, "READY-5150-DEMO");
  assert.equal(claimed.createsNewRecipientState, true);
  assert.match(claimed.referralPath, /ref=ready-coastal-5150/);
});

test("sponsor value is optional, disclosed, non-purchasing, measurable, and reversible", () => {
  const store = new GuideStore();
  const beforeProgress = store.progress();
  const beforeActivations = store.commercialImpact().sponsorActivations;
  const result = store.activateSponsorBenefit("mobility-screening");
  assert.equal(result.status, "activated");
  assert.equal(result.purchaseMade, false);
  assert.match(result.disclosure, /Sponsored action/);
  assert.deepEqual(store.progress(), beforeProgress);
  assert.equal(store.commercialImpact().sponsorActivations, beforeActivations + 1);

  store.undoLastMutation();
  assert.deepEqual(store.getState().sponsorEngagements, []);
  assert.equal(store.commercialImpact().sponsorActivations, beforeActivations);
});

test("commercial impact separates the event-virality and sponsor-accuracy hooks", () => {
  const store = new GuideStore();
  const impact = store.commercialImpact();
  assert.equal(impact.hooks.eventVirality.rewardShares, 2480);
  assert.equal(impact.hooks.eventVirality.cleanReferredStarts, 786);
  assert.equal(impact.hooks.eventVirality.shareToStartRate, 31.7);
  assert.equal(impact.hooks.sponsorAccuracy.verifiedIntentSignals, 860);
  assert.equal(impact.hooks.sponsorAccuracy.verifiedIntentRate, 12.4);
  assert.match(impact.hooks.sponsorAccuracy.accuracyPrinciple, /more accurate understanding of customer intent/i);
  assert.match(impact.hooks.sponsorAccuracy.accuracyPrinciple, /does not claim demographic or predictive accuracy/i);
});

test("the complete synthetic AI draft validates at 100", () => {
  const store = new GuideStore();
  const validation = store.validateDraft(sampleGeneratedDraft);
  assert.equal(validation.valid, true);
  assert.equal(validation.score, 100);
  assert.equal(validation.checkedActions, 9);
  assert.equal(validation.sponsorOpportunities, 1);
});

test("AI guide creation stages before a separate publication and preserves matching progress", () => {
  const store = new GuideStore();
  store.setMode("organizer");
  const staged = store.stageGeneratedGuide(sampleGeneratedDraft);
  assert.equal(staged.status, "staged");
  assert.equal(staged.validation.valid, true);
  assert.equal(store.getState().guide.version, "1.0");

  const published = store.publishDraft();
  assert.equal(published.status, "published");
  assert.equal(published.version, "1.1");
  assert.equal(published.preservedCompletions, 4);
  assert.equal(store.getState().guide.actions.length, 9);
  assert.equal(store.getState().reward.status, "locked");
});

test("participant mode cannot stage or publish official truth", () => {
  const store = new GuideStore();
  assert.throws(() => store.stageGeneratedGuide(sampleGeneratedDraft), /Organizer \+ AI/);
  assert.throws(() => store.publishDraft(), /Organizer \+ AI/);
});

test("validation rejects missing evidence and mandatory sponsored actions", () => {
  const store = new GuideStore();
  const invalid = structuredClone(sampleGeneratedDraft);
  invalid.actions[0].completionEvidence = "";
  invalid.actions.find((action) => action.sponsored).required = true;
  const validation = store.validateDraft(invalid);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((issue) => /completion evidence/.test(issue.message)));
  assert.ok(validation.issues.some((issue) => /cannot be required/.test(issue.message)));
});

test("the WebMCP catalog exposes 13 distinct high-value tools", () => {
  const store = new GuideStore();
  const tools = buildSiteTools({ store, confirmAction: async () => true });
  assert.equal(tools.length, 13);
  assert.equal(new Set(tools.map((tool) => tool.name)).size, 13);
  assert.equal(tools.filter((tool) => tool.annotations?.readOnlyHint).length, 6);
  assert.equal(tools.filter((tool) => !tool.annotations?.readOnlyHint).length, 7);
  assert.ok(tools.some((tool) => tool.name === "stage_ai_guide_draft"));
  assert.ok(tools.some((tool) => tool.name === "claim_readiness_reward"));
  assert.ok(tools.some((tool) => tool.name === "get_commercial_impact"));
});

test("the end-to-end story crosses AI creation, official publication, verification, and reward", async () => {
  const store = new GuideStore();
  const tools = buildSiteTools({ store, confirmAction: async () => true });
  const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));

  store.setMode("organizer");
  const staged = await byName.stage_ai_guide_draft.execute(sampleGeneratedDraft);
  assert.equal(staged.status, "staged");
  const validation = await byName.validate_guide_draft.execute();
  assert.equal(validation.valid, true);
  const published = await byName.publish_official_guide.execute();
  assert.equal(published.status, "published");

  store.setMode("participant");
  const completion = await byName.complete_guide_action.execute({ actionId: "bike-safety" });
  assert.equal(completion.rewardUnlocked, true);
  const reward = await byName.claim_readiness_reward.execute();
  assert.equal(reward.status, "claimed");
  const impact = await byName.get_commercial_impact.execute();
  assert.equal(impact.synthetic, true);
});

test("reset restores the full synthetic outcome baseline", () => {
  const store = new GuideStore();
  store.completeAction("bike-safety");
  store.claimReadinessReward();
  store.activateSponsorBenefit("mobility-screening");
  store.setMode("impact");
  store.reset();
  const state = store.getState();
  assert.equal(state.mode, "participant");
  assert.deepEqual(state.completedActionIds, ["confirm-entry", "arrival-plan", "health-protocol", "swim-equipment"]);
  assert.deepEqual(state.sponsorEngagements, []);
  assert.equal(state.creation.draft, null);
  assert.equal(state.reward.status, "locked");
  assert.equal(store.readiness().percent, 80);
});

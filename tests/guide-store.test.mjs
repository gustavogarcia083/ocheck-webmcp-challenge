import assert from "node:assert/strict";
import test from "node:test";

import { GuideStore } from "../src/guide-store.js";

test("initial progress counts required actions only", () => {
  const store = new GuideStore();
  assert.deepEqual(store.progress(), { completed: 2, total: 9, percent: 22 });
});

test("a personal plan changes only the personal layer", () => {
  const store = new GuideStore();
  const before = store.getState();
  const result = store.createPersonalPlan({
    availableMinutes: 25,
    experience: "first-time",
    accessibilityNeeds: "Concise instructions",
  });
  const after = store.getState();
  assert.ok(result.actionIds.length > 0);
  assert.equal(after.guide.version, before.guide.version);
  assert.deepEqual(after.guide.actions, before.guide.actions);
  assert.equal(after.participant.availableMinutes, 25);
  assert.equal(after.participant.accessibilityNeeds, "Concise instructions");
});

test("completion updates verified progress and undo restores it", () => {
  const store = new GuideStore();
  const completed = store.completeAction("medical-check");
  assert.equal(completed.status, "completed");
  assert.equal(store.progress().completed, 3);
  const undone = store.undoLastMutation();
  assert.equal(undone.status, "undone");
  assert.equal(store.progress().completed, 2);
  assert.equal(store.getState().audit[0].kind, "mutation_undone");
});

test("organizer proposals remain pending until a separate publication", () => {
  const store = new GuideStore();
  store.setMode("organizer");
  const beforeCount = store.getState().guide.actions.length;
  const proposal = store.proposeGuideAction({
    title: "Confirm hydration stations",
    description: "Review every official hydration point before entering transition.",
    phase: "before",
    required: true,
    estimatedMinutes: 4,
  });
  assert.equal(proposal.status, "pending");
  assert.equal(store.getState().pendingChanges.length, 1);
  assert.equal(store.getState().guide.actions.length, beforeCount);

  const published = store.publishGuideChanges();
  assert.equal(published.status, "published");
  assert.equal(published.version, "1.1");
  assert.equal(store.getState().pendingChanges.length, 0);
  assert.equal(store.getState().guide.actions.length, beforeCount + 1);
});

test("participant mode cannot propose or publish official changes", () => {
  const store = new GuideStore();
  assert.throws(
    () =>
      store.proposeGuideAction({
        title: "Unauthorized change",
        description: "This proposal must not be accepted in participant mode.",
        phase: "before",
        estimatedMinutes: 3,
      }),
    /Organizer Mode/,
  );
  assert.throws(() => store.publishGuideChanges(), /Organizer Mode/);
});

test("validation verifies phase coverage and sponsor disclosure", () => {
  const store = new GuideStore();
  const validation = store.validateGuide();
  assert.equal(validation.valid, true);
  assert.equal(validation.issues.length, 0);
  assert.equal(validation.checkedActions, 10);
});

test("sponsor interest is optional, disclosed, and reversible", () => {
  const store = new GuideStore();
  const result = store.recordSponsorInterest("recovery-assessment");
  assert.equal(result.status, "selected");
  assert.equal(result.disclosure, "Synthetic sponsored action");
  assert.deepEqual(store.getState().sponsorEngagements, ["recovery-assessment"]);
  store.undoLastMutation();
  assert.deepEqual(store.getState().sponsorEngagements, []);
});

test("reset restores the full synthetic baseline", () => {
  const store = new GuideStore();
  store.completeAction("medical-check");
  store.setMode("organizer");
  store.reset();
  const state = store.getState();
  assert.equal(state.mode, "participant");
  assert.deepEqual(state.completedActionIds, ["confirm-entry", "travel-plan"]);
  assert.deepEqual(state.pendingChanges, []);
  assert.deepEqual(store.progress(), { completed: 2, total: 9, percent: 22 });
});

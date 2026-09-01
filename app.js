import { GuideStore } from "./src/guide-store.js";
import { sampleGeneratedDraft } from "./src/demo-data.js";
import { buildSiteTools, registerSiteTools } from "./src/site-tools.js";

const store = new GuideStore();
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let activePhase = "all";
let activeActionId = null;
let pendingConfirmation = null;
let previousFocus = null;
let toastTimer = null;

const confirmationModal = $("#confirmation-modal");
const confirmationCard = $(".confirmation-modal", confirmationModal);
const approveButton = $("#confirmation-approve");
const cancelButton = $("#confirmation-cancel");
const actionModal = $("#action-modal");
const rewardModal = $("#reward-modal");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function titleCase(value) {
  return String(value ?? "")
    .split(/[-_ ]/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3600);
}

async function copyText(value, successMessage = "Copied to clipboard") {
  try {
    await navigator.clipboard.writeText(value);
    showToast(successMessage);
  } catch {
    showToast("Clipboard access is unavailable. Select and copy the prompt manually.");
  }
}

function closeConfirmation(approved) {
  if (!pendingConfirmation) return;
  confirmationModal.hidden = true;
  confirmationCard.classList.remove("danger");
  const resolve = pendingConfirmation;
  pendingConfirmation = null;
  resolve(approved);
  previousFocus?.focus?.();
  previousFocus = null;
}

export function confirmAction({
  eyebrow = "Human confirmation",
  title,
  summary,
  details = {},
  confirmLabel = "Confirm",
  danger = false,
}) {
  if (pendingConfirmation) return Promise.resolve(false);
  previousFocus = document.activeElement;
  $("#confirmation-eyebrow").textContent = eyebrow;
  $("#confirmation-title").textContent = title;
  $("#confirmation-summary").textContent = summary;
  $("#confirmation-details").textContent = JSON.stringify(details, null, 2);
  approveButton.textContent = confirmLabel;
  confirmationCard.classList.toggle("danger", danger);
  confirmationModal.hidden = false;
  approveButton.focus();
  return new Promise((resolve) => {
    pendingConfirmation = resolve;
  });
}

function actionCard(action, state, nextBestActionId) {
  const completed = state.completedActionIds.includes(action.id);
  const personal = state.personalPlan.includes(action.id);
  const activated = state.sponsorEngagements.some((entry) => entry.actionId === action.id);
  const classes = [
    "action-card",
    completed ? "completed" : "",
    nextBestActionId === action.id ? "next" : "",
    action.sponsored ? "sponsored" : "",
  ].filter(Boolean).join(" ");
  const tags = [
    action.official ? "<span>Official</span>" : "",
    action.required ? "<span>Required</span>" : "<span>Optional</span>",
    action.critical ? '<span class="critical">Critical</span>' : "",
    personal ? "<span>Personal plan</span>" : "",
    action.sponsored ? `<span class="partner">${activated ? "Benefit active" : "Sponsored utility"}</span>` : "",
  ].join("");

  return `
    <article class="${classes}" data-action-id="${escapeHtml(action.id)}">
      <button class="action-state" type="button" data-toggle="${escapeHtml(action.id)}"
        aria-label="${completed ? "Completed" : "Verify as complete"}: ${escapeHtml(action.title)}"
        ${completed ? "disabled" : ""}><i>✓</i></button>
      <button class="action-open" type="button" data-open="${escapeHtml(action.id)}">
        <strong>${escapeHtml(action.title)}</strong>
        <small>${escapeHtml(action.description)}</small>
        <span class="action-tags">${tags}</span>
      </button>
      <span class="action-deadline">${escapeHtml(action.deadline)}<br />${action.estimatedMinutes} min</span>
    </article>`;
}

function renderActions(state) {
  const outcome = store.outcomeState();
  const actions = store.listActions({ phase: activePhase });
  $("#action-list").innerHTML = actions.length
    ? actions.map((action) => actionCard(action, state, outcome.nextBestAction?.id)).join("")
    : '<div class="empty-plan">No actions in this phase.</div>';
}

function renderPersonalPlan(state) {
  const root = $("#personal-plan");
  if (!state.personalPlan.length) {
    root.innerHTML = '<div class="empty-plan">The agent can prioritize this official path without rewriting it.</div>';
    return;
  }
  const actions = state.personalPlan
    .map((id) => state.guide.actions.find((action) => action.id === id))
    .filter(Boolean);
  root.innerHTML = `
    <ol class="plan-list">
      ${actions.map((action, index) => `
        <li>
          <span>${index + 1}</span>
          <strong>${escapeHtml(action.title)}</strong>
          <small>${action.estimatedMinutes} min</small>
        </li>`).join("")}
    </ol>`;
}

function renderPrompts() {
  const participantPrompts = [
    "Read my OCHECK outcome state. First explain what scattered information, services, and actors OCHECK integrated so I do not have to. I have 25 minutes, this is my first event, and I prefer concise, low-impact guidance. Create a personal plan without changing official truth.",
    "Show my remaining critical preparation actions. Complete the bicycle safety check only after I confirm; if that makes me ready, explain the Ready Pass, its clean referral, and how sharing the achievement helps the event grow before claiming it.",
    "Show the optional sponsored opportunity inside my official experience, explain why it is relevant, its disclosure and terms, and activate it only after I confirm. Explain the aggregate, non-identifying high-intent signal created without marking any official action complete or exposing my identity, contact data, or personal progress.",
  ];
  const organizerPrompts = [
    "Read the current organizer brief. First identify every fragmented touchpoint, source, actor, service, and burden currently integrated by the customer. Then design OCHECK as the organizer-governed official and sponsor-enabled integration layer: one outcome contract with a clear result, definition of done, sequenced actions, completion evidence, sources, assumptions, open questions, one optional disclosed sponsor opportunity, and a shareable Ready Pass. Keep two ethical growth hooks inside that official experience: satisfaction-led achievement sharing for event reach and aggregate contextual opt-in signals for sponsor insight without identifying participants. Stage the draft but do not publish.",
    "Validate the staged guide. Explain every blocking issue and open question without changing the draft.",
    "If validation passes, show me exactly what will become official and publish only after my explicit confirmation.",
  ];
  $("#participant-prompts").innerHTML = participantPrompts
    .map((prompt) => `<button class="prompt-chip" type="button" data-prompt="${escapeHtml(prompt)}">“${escapeHtml(prompt)}”</button>`)
    .join("");
  $("#organizer-prompts").innerHTML = organizerPrompts
    .map((prompt) => `<button class="prompt-chip" type="button" data-prompt="${escapeHtml(prompt)}">“${escapeHtml(prompt)}”</button>`)
    .join("");
}

function renderAudit(state) {
  $("#audit-list").innerHTML = state.audit
    .slice(0, 5)
    .map((entry) => `
      <li>
        <span>${escapeHtml(entry.summary)}</span>
        <time datetime="${escapeHtml(entry.at)}">${escapeHtml(entry.actor)} · ${new Date(entry.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
      </li>`)
    .join("");
}

function renderParticipant(state) {
  const readiness = store.readiness();
  const progress = store.progress();
  const outcome = store.outcomeState();
  $("#guide-title").textContent = state.guide.title;
  $("#guide-meta").textContent = `${state.guide.eventDate} · ${state.guide.location}`;
  $("#guide-outcome").textContent = state.guide.outcome;
  $("#guide-version").textContent = `Official · v${state.guide.version}`;
  $("#readiness-completed").textContent = readiness.completed;
  $("#readiness-total").textContent = readiness.total;
  $("#readiness-percent").textContent = `${readiness.percent}%`;
  $("#readiness-fill").style.width = `${readiness.percent}%`;
  $("#overall-progress").textContent = `${progress.completed} of ${progress.total}`;

  const remainingPreparation = state.guide.actions.filter((action) => (
    action.phase === "before"
    && action.required
    && !state.completedActionIds.includes(action.id)
  )).length;
  $("#reward-teaser-benefit").textContent = state.readyPass.status === "claimed"
    ? "Achievement claimed · your clean referral can invite the next participant without sharing your progress."
    : state.readyPass.status === "available"
      ? `Unlocked · ${state.readyPass.benefit}`
      : `${remainingPreparation} required preparation ${remainingPreparation === 1 ? "check" : "checks"} left · ${state.readyPass.benefit}`;
  $("#preview-reward").textContent = state.readyPass.status === "claimed"
    ? "View Ready Pass"
    : state.readyPass.status === "available"
      ? "Claim Ready Pass"
      : "Preview Ready Pass";

  const rewardChip = $("#reward-chip");
  rewardChip.className = `reward-chip ${state.readyPass.status}`;
  rewardChip.textContent = state.readyPass.status === "claimed"
    ? "Ready Pass · Claimed"
    : state.readyPass.status === "available"
      ? "Ready Pass · Unlocked"
      : "Ready Pass · Locked";
  $("#ready-banner").hidden = state.readyPass.status === "locked";
  $("#ready-banner-title").textContent = state.readyPass.status === "claimed"
    ? "Your verified Ready Pass has been claimed."
    : "Your OCHECK Ready Pass is available.";

  $("#outcome-result").textContent = outcome.outcome;
  $("#definition-done").textContent = outcome.definitionOfDone;
  $("#current-phase").textContent = titleCase(outcome.currentPhase);
  $("#next-action").textContent = outcome.nextBestAction
    ? `${outcome.nextBestAction.title} · ${outcome.nextBestAction.deadline}`
    : "Every required loop is closed.";
  $("#profile-experience").textContent = titleCase(state.participant.experience);
  $("#profile-minutes").textContent = `${state.participant.availableMinutes} min`;
  $("#profile-accessibility").textContent = state.participant.accessibilityNeeds || "No preference specified";
  renderActions(state);
  renderPersonalPlan(state);
  renderAudit(state);
}

function renderDraft(state) {
  const root = $("#draft-preview");
  const draft = state.creation.draft;
  const validation = store.validateDraft();
  const status = $("#draft-status");
  $("#draft-score").textContent = draft ? `${validation.score}/100` : "—";
  $("#publish-draft").disabled = !draft || !validation.valid;

  if (!draft) {
    status.textContent = "No draft staged";
    status.className = "draft-status";
    root.innerHTML = `
      <div class="empty-state">
        <span aria-hidden="true">✦</span>
        <h4>Ask ChatGPT to build the guide.</h4>
        <p>The agent integrates scattered inputs into one governed journey, preserves assumptions, exposes open questions, and waits for human approval.</p>
      </div>`;
    return;
  }

  status.textContent = validation.valid
    ? "Validated · Ready for human publication"
    : `${validation.errors} blocking issue${validation.errors === 1 ? "" : "s"}`;
  status.className = `draft-status ${validation.valid ? "valid" : "invalid"}`;
  const questionItems = draft.openQuestions?.length
    ? draft.openQuestions.map((question) => `<li>${escapeHtml(question)}</li>`).join("")
    : "<li>No unresolved organizer questions.</li>";
  root.innerHTML = `
    <article class="draft-document">
      <header>
        <small>AI-generated · Not official until published</small>
        <h4>${escapeHtml(draft.title)}</h4>
        <p>${escapeHtml(draft.outcome)}</p>
      </header>
      <div class="draft-integration">
        <span>Official integration layer</span>
        <strong>Organizer-approved truth, participant guidance, authorized partner value, and shareable achievement become one governed experience.</strong>
      </div>
      <div class="draft-definition">
        <span>Definition of done</span>
        <strong>${escapeHtml(draft.definitionOfDone)}</strong>
      </div>
      <div class="draft-actions">
        ${draft.actions.map((action) => `
          <div class="draft-action ${action.sponsored ? "sponsored" : ""}">
            <span>${escapeHtml(action.phase)}</span>
            <div>
              <strong>${escapeHtml(action.title)}</strong>
              <small>${escapeHtml(action.completionEvidence)}</small>
            </div>
            <b>${action.sponsored ? "Partner" : action.required ? "Required" : "Optional"}</b>
          </div>`).join("")}
      </div>
      <div class="draft-reward">
        <span>Satisfaction + event reach hook</span>
        <strong>${escapeHtml(draft.readyPass.title)} · ${escapeHtml(draft.readyPass.unlockRule)}</strong>
        <small>${escapeHtml(draft.readyPass.benefit)} · A clean referral turns verified achievement into organic reach.</small>
      </div>
      <div class="draft-questions">
        <span>Open loops</span>
        <ul>${questionItems}</ul>
      </div>
    </article>`;
}

function renderImpact() {
  const impact = store.commercialImpact();
  $("#metric-readiness").textContent = `${impact.readinessRate}%`;
  $("#metric-sponsor-open").textContent = `${impact.sponsorOpenRate}%`;
  $("#metric-sponsor-activation").textContent = `${impact.sponsorActivationRate}%`;
  $("#metric-referral").textContent = `${impact.readyPassReferralRate}%`;
  $("#impact-impressions").textContent = formatNumber(impact.sponsorImpressions);
  $("#impact-opens").textContent = formatNumber(impact.sponsorActionOpens);
  $("#impact-activations").textContent = formatNumber(impact.sponsorActivations);
  $("#impact-intent-signals").textContent = formatNumber(impact.hooks.sponsorAccuracy.verifiedIntentSignals);
  $("#impact-shares").textContent = formatNumber(impact.readyPassShares);
  $("#impact-referrals").textContent = formatNumber(impact.referredStarts);
}

function renderReadyPass(state) {
  const readyPass = state.readyPass;
  $("#reward-state").textContent = titleCase(readyPass.status);
  $("#reward-title").textContent = readyPass.title;
  $("#reward-benefit").textContent = readyPass.benefit;
  $("#ready-pass-title").textContent = `I AM READY FOR ${state.guide.title.replace(/—.*$/, "").trim().toUpperCase()}`;
  $("#ready-pass-meta").textContent = `${state.guide.eventDate} · ${state.guide.location}`;
  $("#ready-pass-code").textContent = readyPass.status === "claimed"
    ? `Verified code · ${readyPass.code}`
    : readyPass.status === "available"
      ? "Unlocked · Claim after human confirmation"
      : readyPass.unlockRule;
  const claim = $("#claim-reward");
  claim.disabled = readyPass.status !== "available";
  claim.textContent = readyPass.status === "claimed"
    ? "Ready Pass claimed"
    : readyPass.status === "available"
      ? "Claim Ready Pass"
      : "Complete preparation to earn your Ready Pass";
  $("#copy-ready-pass").hidden = readyPass.status !== "claimed";
}

function render(state) {
  for (const view of $$("[data-view]")) view.hidden = view.dataset.view !== state.mode;
  for (const button of $$("[data-mode]")) {
    button.setAttribute("aria-pressed", String(button.dataset.mode === state.mode));
  }
  renderParticipant(state);
  renderDraft(state);
  renderImpact();
  renderReadyPass(state);

  const briefInput = $("#creation-brief");
  if (document.activeElement !== briefInput && briefInput.value !== state.brief.raw) {
    briefInput.value = state.brief.raw;
  }
  $("#brief-count").textContent = `${briefInput.value.length} characters`;
}

function renderToolCatalog(tools) {
  $("#tool-grid").innerHTML = tools.map((tool) => {
    const readOnly = Boolean(tool.annotations?.readOnlyHint);
    return `
      <article class="tool-card">
        <header><code>${escapeHtml(tool.name)}</code><span>${readOnly ? "Read" : "Confirm + write"}</span></header>
        <p>${escapeHtml(tool.description)}</p>
      </article>`;
  }).join("");
}

function openAction(actionId) {
  const state = store.getState();
  const action = state.guide.actions.find((candidate) => candidate.id === actionId);
  if (!action) return;
  activeActionId = actionId;
  const completed = state.completedActionIds.includes(actionId);
  const engagement = state.sponsorEngagements.find((entry) => entry.actionId === actionId);
  $("#action-eyebrow").textContent = action.sponsored
    ? "Optional sponsored utility"
    : `${titleCase(action.phase)} · Official action`;
  const actionStatus = $("#action-status");
  actionStatus.textContent = completed ? "Verified" : "Pending";
  actionStatus.classList.toggle("done", completed);
  $("#action-title").textContent = action.title;
  $("#action-description").textContent = action.description;
  $("#action-evidence").textContent = action.completionEvidence;
  $("#action-source").textContent = action.sourceRef;

  const sponsorOffer = $("#sponsor-offer");
  sponsorOffer.hidden = !action.sponsored;
  if (action.sponsored) {
    $("#sponsor-disclosure").textContent = action.sponsored.disclosure;
    $("#sponsor-partner").textContent = action.sponsored.partner;
    $("#sponsor-headline").textContent = action.sponsored.headline;
    $("#sponsor-value").textContent = action.sponsored.value;
    $("#sponsor-terms").textContent = action.sponsored.terms;
    $("#activate-sponsor").textContent = engagement ? `Activated · ${engagement.demoCode}` : action.sponsored.ctaLabel;
    $("#activate-sponsor").disabled = Boolean(engagement);
  }

  $("#complete-action").disabled = completed;
  $("#complete-action").textContent = completed ? "Verified complete" : "Verify as complete";
  actionModal.hidden = false;
  $("#action-close").focus();
}

function closeAction() {
  actionModal.hidden = true;
  activeActionId = null;
}

function openReadyPass() {
  renderReadyPass(store.getState());
  rewardModal.hidden = false;
  $("#reward-close").focus();
}

function closeReadyPass() {
  rewardModal.hidden = true;
}

async function completeFromInterface(actionId) {
  const action = store.getState().guide.actions.find((candidate) => candidate.id === actionId);
  if (!action) return;
  const approved = await confirmAction({
    eyebrow: "Verified Progress · Human confirmation",
    title: "Confirm this completed action?",
    summary: `Mark “${action.title}” complete using its evidence rule: ${action.completionEvidence}`,
    details: { actionId, title: action.title, official: action.official, evidence: action.completionEvidence },
    confirmLabel: "Confirm completion",
  });
  if (!approved) return;
  const result = store.completeAction(actionId);
  showToast(result.readyPassUnlocked
    ? "Progress verified. Your Ready Pass is unlocked—and the satisfaction hook is ready to share."
    : "Progress verified and added to the audit trail.");
  if (result.readyPassUnlocked) {
    closeAction();
    openReadyPass();
  } else if (!actionModal.hidden) {
    openAction(actionId);
  }
}

async function activateSponsorFromInterface(actionId) {
  const action = store.getState().guide.actions.find((candidate) => candidate.id === actionId && candidate.sponsored);
  if (!action) return;
  const approved = await confirmAction({
    eyebrow: "Sponsored utility · Human confirmation",
    title: "Activate this optional demo benefit?",
    summary: `${action.sponsored.partner} offers ${action.sponsored.value}. No purchase will be made and official completion will not change.`,
    details: {
      actionId,
      disclosure: action.sponsored.disclosure,
      value: action.sponsored.value,
      terms: action.sponsored.terms,
      purchaseMade: false,
    },
    confirmLabel: "Activate demo benefit",
  });
  if (!approved) return;
  const result = store.activateSponsorBenefit(actionId);
  showToast(`Optional benefit activated · ${result.demoCode}. One synthetic high-intent signal was recorded; official progress did not change.`);
  openAction(actionId);
}

approveButton.addEventListener("click", () => closeConfirmation(true));
cancelButton.addEventListener("click", () => closeConfirmation(false));
confirmationModal.addEventListener("click", (event) => {
  if (event.target === confirmationModal) closeConfirmation(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (pendingConfirmation) closeConfirmation(false);
  else if (!rewardModal.hidden) closeReadyPass();
  else if (!actionModal.hidden) closeAction();
});

for (const button of $$("[data-mode]")) {
  button.addEventListener("click", () => store.setMode(button.dataset.mode));
}

for (const button of $$("[data-phase]")) {
  button.addEventListener("click", () => {
    activePhase = button.dataset.phase;
    for (const candidate of $$("[data-phase]")) {
      candidate.setAttribute("aria-selected", String(candidate === button));
    }
    renderActions(store.getState());
  });
}

$("#action-list").addEventListener("click", (event) => {
  const toggleButton = event.target.closest("[data-toggle]");
  if (toggleButton) {
    completeFromInterface(toggleButton.dataset.toggle);
    return;
  }
  const openButton = event.target.closest("[data-open]");
  if (openButton) openAction(openButton.dataset.open);
});

$("#guide-next").addEventListener("click", () => {
  const next = store.outcomeState().nextBestAction;
  if (next) openAction(next.id);
  else openReadyPass();
});

$("#action-close").addEventListener("click", closeAction);
$("#keep-pending").addEventListener("click", closeAction);
actionModal.addEventListener("click", (event) => {
  if (event.target === actionModal) closeAction();
});
$("#complete-action").addEventListener("click", () => {
  if (activeActionId) completeFromInterface(activeActionId);
});
$("#activate-sponsor").addEventListener("click", () => {
  if (activeActionId) activateSponsorFromInterface(activeActionId);
});

$("#reward-chip").addEventListener("click", openReadyPass);
$("#preview-reward").addEventListener("click", openReadyPass);
$("#open-reward").addEventListener("click", openReadyPass);
$("#reward-close").addEventListener("click", closeReadyPass);
rewardModal.addEventListener("click", (event) => {
  if (event.target === rewardModal) closeReadyPass();
});
$("#claim-reward").addEventListener("click", async () => {
  const state = store.getState();
  if (state.readyPass.status !== "available") {
    showToast(state.readyPass.status === "claimed" ? "This Ready Pass is already claimed." : "Complete every required Before action to unlock your Ready Pass.");
    return;
  }
  const approved = await confirmAction({
    eyebrow: "Verified result · Human confirmation",
    title: `Claim “${state.readyPass.title}”?`,
    summary: "Create the shareable Ready Pass and a clean referral path. No purchase is made.",
    details: { readiness: store.readiness(), readyPass: state.readyPass, purchaseMade: false },
    confirmLabel: "Claim Ready Pass",
  });
  if (!approved) return;
  store.claimReadyPass();
  showToast("Ready Pass claimed. Your achievement can now create organic event reach through a clean referral.");
  openReadyPass();
});

$("#copy-ready-pass").addEventListener("click", async () => {
  const state = store.getState();
  if (state.readyPass.status !== "claimed") return;
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("ref", state.readyPass.referralCode);
  url.searchParams.set("utm_source", "ocheck_ready_pass");
  url.searchParams.set("utm_medium", "share");
  await copyText(url.toString(), "Clean Ready Pass referral link copied.");
});

$("#create-plan").addEventListener("click", async () => {
  const input = {
    availableMinutes: 25,
    experience: "first-time",
    accessibilityNeeds: "Prefer concise instructions and low-impact transitions.",
    includeSponsored: false,
  };
  const approved = await confirmAction({
    eyebrow: "Personal Assist · Human confirmation",
    title: "Create this personal plan?",
    summary: "Prioritize official actions for 25 available minutes without changing official truth.",
    details: input,
    confirmLabel: "Create personal plan",
  });
  if (!approved) return;
  store.createPersonalPlan(input);
  showToast("Personal plan created. The official guide remains unchanged.");
});

$("#creation-brief").addEventListener("input", (event) => {
  store.updateBrief(event.target.value);
  $("#brief-count").textContent = `${event.target.value.length} characters`;
});

$("#stage-demo-draft").addEventListener("click", async () => {
  const state = store.getState();
  if (state.mode !== "organizer") return;
  const approved = await confirmAction({
    eyebrow: "Browser fallback · Human review",
    title: "Stage the demonstration draft?",
    summary: `Create a visible draft with ${sampleGeneratedDraft.actions.length} actions from the current synthetic brief. Nothing will be published.`,
    details: {
      title: sampleGeneratedDraft.title,
      outcome: sampleGeneratedDraft.outcome,
      actions: sampleGeneratedDraft.actions.map((action) => ({ title: action.title, phase: action.phase, sponsored: Boolean(action.sponsored) })),
      readyPass: sampleGeneratedDraft.readyPass,
    },
    confirmLabel: "Stage demo draft",
  });
  if (!approved) return;
  const result = store.stageGeneratedGuide(sampleGeneratedDraft);
  showToast(`AI-style draft staged · validation ${result.validation.score}/100. It is not official yet.`);
});

$("#validate-draft").addEventListener("click", () => {
  const validation = store.validateDraft();
  showToast(validation.valid
    ? `Draft valid · ${validation.score}/100 · ${validation.checkedActions} actions checked.`
    : `Draft not ready · ${validation.errors || 1} blocking issue${validation.errors === 1 ? "" : "s"}.`);
  render(store.getState());
});

$("#publish-draft").addEventListener("click", async () => {
  const state = store.getState();
  const validation = store.validateDraft();
  if (!validation.valid) {
    showToast("Resolve every blocking validation issue before publishing.");
    return;
  }
  const approved = await confirmAction({
    eyebrow: "Official truth · Consequential action",
    title: "Publish this validated guide?",
    summary: `Publish “${state.creation.draft.title}” and increment official version ${state.guide.version}.`,
    details: { validation, draft: state.creation.draft },
    confirmLabel: "Publish official guide",
    danger: true,
  });
  if (!approved) return;
  const result = store.publishDraft();
  showToast(`Official guide v${result.version} published. Matching verified progress was preserved.`);
});

$("#undo-action").addEventListener("click", async () => {
  const approved = await confirmAction({
    eyebrow: "Recovery · Human confirmation",
    title: "Undo the last confirmed change?",
    summary: "Restore the previous OCHECK state and record the recovery.",
    details: { reversibleDemoAction: true },
    confirmLabel: "Undo last change",
  });
  if (!approved) return;
  const result = store.undoLastMutation();
  showToast(result.status === "undone" ? `Undid: ${result.summary}` : "There is no confirmed change to undo.");
});

$("#reset-demo").addEventListener("click", async () => {
  const approved = await confirmAction({
    eyebrow: "Repeatable judging",
    title: "Reset the complete demonstration?",
    summary: "Restore the synthetic brief, official guide, progress, partner funnel, Ready Pass, and audit baseline.",
    details: { resetsOnlySyntheticDemoState: true },
    confirmLabel: "Reset demo",
    danger: true,
  });
  if (!approved) return;
  activePhase = "all";
  for (const button of $$("[data-phase]")) {
    button.setAttribute("aria-selected", String(button.dataset.phase === "all"));
  }
  closeAction();
  closeReadyPass();
  store.reset();
  showToast("The complete OCHECK official-experience demonstration was reset.");
});

for (const root of [$("#participant-prompts"), $("#organizer-prompts")]) {
  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-prompt]");
    if (button) copyText(button.dataset.prompt, "Prompt copied. Paste it into ChatGPT beside this page.");
  });
}

$("#copy-organizer-prompt").addEventListener("click", () => copyText(
  "Read the current organizer brief with get_creation_brief. Identify the fragmented sources, actors, services, and customer self-integration burden. Convert them into OCHECK as the organizer-governed official and sponsor-enabled integration layer: one explicit result, a definition of done, sequenced Before/During/After actions, observable completion evidence, source traceability, assumptions, open questions, one optional and clearly disclosed sponsor opportunity that is never required, and a shareable Ready Pass. Design an ethical dual hook inside that official experience: satisfaction-led achievement sharing for event reach and aggregate contextual opt-in signals for more accurate sponsor audience understanding without exposing participant identity, contact data, or personal progress. Stage it with stage_ai_guide_draft, then validate it. Do not publish until I explicitly confirm.",
  "AI guide-creation prompt copied.",
));

$("#copy-demo-prompt").addEventListener("click", () => copyText(
  "Work with the OCHECK page using its Site Tools and the same visible state. First explain how the customer currently integrates a fragmented experience. In Organizer + AI mode, read the scattered brief and stage OCHECK as the organizer-governed official and sponsor-enabled integration layer, including a satisfaction hook built around a shareable Ready Pass and an optional contextual sponsor hook based only on aggregate, non-identifying intent signals. Validate it and publish only after my confirmation. Then, in Participant mode, show the unified official experience, create a 25-minute personal plan without changing official truth, verify the last critical preparation action after my confirmation, explain and claim the unlocked Ready Pass only after I approve, and show how its clean referral creates organic reach without transferring progress. Show the disclosed sponsor value without making it mandatory, then read commercial impact and distinguish official integration, impressions, contextual interest, explicit opt-ins, shares, and referred starts. Never expose participant identity, contact data, or personal progress to partners, and never skip a confirmation.",
  "Complete end-to-end demo prompt copied.",
));

const tools = buildSiteTools({ store, confirmAction });
renderToolCatalog(tools);
renderPrompts();
store.subscribe(render);
render(store.getState());

registerSiteTools({
  tools,
  onStatus: ({ supported, registered, message }) => {
    $("#registered-tool-count").textContent = registered;
    $("#site-tools-status").textContent = supported ? "Site Tools active" : "Browser fallback";
    $("#status-dot").classList.toggle("active", supported);
    $("#site-tools-status").title = message;
  },
}).catch((error) => {
  $("#site-tools-status").textContent = "Site Tools unavailable";
  $("#site-tools-status").title = error instanceof Error ? error.message : String(error);
});

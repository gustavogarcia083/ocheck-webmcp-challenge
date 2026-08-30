import { GuideStore } from "./src/guide-store.js";
import { buildSiteTools, registerSiteTools } from "./src/site-tools.js";

const store = new GuideStore();
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let activePhase = "all";
let pendingConfirmation = null;
let previousFocus = null;
let toastTimer = null;

const modal = $("#confirmation-modal");
const modalCard = $(".confirmation-modal", modal);
const approveButton = $("#confirmation-approve");
const cancelButton = $("#confirmation-cancel");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function titleCase(value) {
  return String(value)
    .split(/[-_ ]/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3400);
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
  modal.hidden = true;
  modalCard.classList.remove("danger");
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
  modalCard.classList.toggle("danger", danger);
  modal.hidden = false;
  approveButton.focus();
  return new Promise((resolve) => {
    pendingConfirmation = resolve;
  });
}

function actionCard(action, state) {
  const completed = state.completedActionIds.includes(action.id);
  const personal = state.personalPlan.includes(action.id);
  const sponsorSelected = state.sponsorEngagements.includes(action.id);
  const classes = ["action-card", completed ? "completed" : "", personal ? "personal" : "", action.sponsored ? "sponsored" : ""]
    .filter(Boolean)
    .join(" ");
  const badges = [
    action.official ? '<span class="action-badge">Official</span>' : "",
    action.required ? '<span class="action-badge">Required</span>' : '<span class="action-badge">Optional</span>',
    action.critical ? '<span class="action-badge critical">Critical</span>' : "",
    personal ? '<span class="action-badge personal-badge">In personal plan</span>' : "",
    action.sponsored ? `<span class="action-badge partner">${escapeHtml(action.sponsored.disclosure)}</span>` : "",
  ].join("");

  const sponsorButton = action.sponsored
    ? `<button class="partner-button" type="button" data-sponsor="${escapeHtml(action.id)}" ${sponsorSelected ? "disabled" : ""}>
        ${sponsorSelected ? "Interest saved" : `See ${escapeHtml(action.sponsored.value)}`}
      </button>`
    : "";

  return `
    <article class="${classes}" data-action-id="${escapeHtml(action.id)}">
      <button class="completion-button" type="button" data-complete="${escapeHtml(action.id)}"
        aria-label="${completed ? "Completed" : "Mark complete"}: ${escapeHtml(action.title)}"
        ${completed ? "disabled" : ""}>✓</button>
      <div class="action-copy">
        <h4>${escapeHtml(action.title)}</h4>
        <p>${escapeHtml(action.description)}</p>
        <div class="action-meta">${badges}</div>
        ${sponsorButton}
      </div>
      <span class="action-deadline">${escapeHtml(action.deadline)} · ${action.estimatedMinutes} min</span>
    </article>`;
}

function renderActions(state) {
  const actions = store.listActions({ phase: activePhase });
  const list = $("#action-list");
  list.innerHTML = actions.length
    ? actions.map((action) => actionCard(action, state)).join("")
    : '<div class="empty-state"><p>No actions in this phase.</p></div>';
}

function renderPersonalPlan(state) {
  const root = $("#personal-plan");
  if (!state.personalPlan.length) {
    root.innerHTML = `
      <div class="empty-state">
        <span aria-hidden="true">✦</span>
        <p>The agent can prioritize official actions here without changing the guide.</p>
      </div>`;
    return;
  }
  const actions = state.personalPlan
    .map((id) => state.guide.actions.find((action) => action.id === id))
    .filter(Boolean);
  root.innerHTML = `
    <ol class="plan-list">
      ${actions
        .map(
          (action, index) => `<li><strong>${index + 1}. ${escapeHtml(action.title)}</strong>${escapeHtml(action.estimatedMinutes)} min · ${escapeHtml(action.deadline)}</li>`,
        )
        .join("")}
    </ol>`;
}

function renderPendingChanges(state) {
  const root = $("#pending-list");
  if (!state.pendingChanges.length) {
    root.innerHTML = '<div class="empty-state"><p>No changes are waiting for organizer review.</p></div>';
    return;
  }
  root.innerHTML = `<ul>${state.pendingChanges
    .map(
      (change) => `<li><strong>${escapeHtml(change.action.title)}</strong>${escapeHtml(titleCase(change.action.phase))} · pending publication</li>`,
    )
    .join("")}</ul>`;
}

function renderPrompts(state) {
  const participantPrompts = [
    "I have 45 minutes, this is my first event, and I prefer low-impact transitions. Create my personal plan without changing the official guide.",
    "Show me the remaining critical actions and explain why each one matters.",
    "Mark the health and safety protocol complete, but ask for my confirmation first.",
  ];
  const organizerPrompts = [
    "Validate the official guide and report every issue without changing anything.",
    "Propose a required before-event action called ‘Confirm hydration stations’ and place it in the review queue.",
    "Show me the pending diff and publish it only after I explicitly confirm.",
  ];
  const prompts = state.mode === "participant" ? participantPrompts : organizerPrompts;
  $("#prompt-list").innerHTML = prompts
    .map((prompt) => `<button class="prompt-chip" type="button" data-prompt="${escapeHtml(prompt)}">“${escapeHtml(prompt)}”</button>`)
    .join("");
}

function renderAudit(state) {
  $("#audit-list").innerHTML = state.audit
    .slice(0, 5)
    .map(
      (entry) => `<li>${escapeHtml(entry.summary)}<time datetime="${escapeHtml(entry.at)}">${escapeHtml(entry.actor)} · ${new Date(entry.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></li>`,
    )
    .join("");
}

function render(state) {
  const progress = store.progress();
  $("#guide-title").textContent = state.guide.title;
  $("#guide-meta").textContent = `${state.guide.eventDate} · ${state.guide.location}`;
  $("#guide-outcome").textContent = state.guide.outcome;
  $("#guide-version").textContent = `v${state.guide.version}`;
  $("#progress-percent").textContent = `${progress.percent}%`;
  $("#progress-completed").textContent = progress.completed;
  $("#progress-total").textContent = progress.total;
  $("#progress-ring").style.setProperty("--progress", `${progress.percent * 3.6}deg`);

  $("#profile-experience").textContent = titleCase(state.participant.experience);
  $("#profile-minutes").textContent = `${state.participant.availableMinutes} min`;
  $("#profile-accessibility").textContent = state.participant.accessibilityNeeds || "None specified";
  $("#organizer-version").textContent = state.guide.version;
  $("#pending-count").textContent = `${state.pendingChanges.length} change${state.pendingChanges.length === 1 ? "" : "s"}`;
  const validation = store.validateGuide();
  $("#validation-status").textContent = validation.valid ? "Ready" : `${validation.issues.length} issues`;

  $("#mode-title").textContent = state.mode === "participant" ? "Participant Mode" : "Organizer Mode";
  $("#participant-panel").hidden = state.mode !== "participant";
  $("#organizer-panel").hidden = state.mode !== "organizer";
  for (const button of $$("[data-mode]")) {
    button.setAttribute("aria-pressed", String(button.dataset.mode === state.mode));
  }

  renderActions(state);
  renderPersonalPlan(state);
  renderPendingChanges(state);
  renderPrompts(state);
  renderAudit(state);
}

function renderToolCatalog(tools) {
  $("#tool-grid").innerHTML = tools
    .map((tool) => {
      const readOnly = Boolean(tool.annotations?.readOnlyHint);
      return `<article class="tool-card ${readOnly ? "read" : "write"}">
        <header><code>${escapeHtml(tool.name)}</code><span>${readOnly ? "Read" : "Confirm + write"}</span></header>
        <p>${escapeHtml(tool.description)}</p>
      </article>`;
    })
    .join("");
}

async function completeFromInterface(actionId) {
  const action = store.getState().guide.actions.find((candidate) => candidate.id === actionId);
  if (!action) return;
  const approved = await confirmAction({
    eyebrow: "Verified progress",
    title: "Confirm completion?",
    summary: `Mark “${action.title}” as complete and update visible progress.`,
    details: { actionId, official: action.official },
    confirmLabel: "Confirm completion",
  });
  if (approved) {
    store.completeAction(actionId);
    showToast("Progress updated and added to the audit trail.");
  }
}

async function selectSponsorFromInterface(actionId) {
  const action = store.getState().guide.actions.find((candidate) => candidate.id === actionId && candidate.sponsored);
  if (!action) return;
  const approved = await confirmAction({
    eyebrow: "Clearly disclosed partner action",
    title: "Save interest in this option?",
    summary: `${action.sponsored.partner} offers: ${action.sponsored.value}. No purchase will be made.`,
    details: { actionId, optional: true, disclosure: action.sponsored.disclosure },
    confirmLabel: "Save interest",
  });
  if (approved) {
    store.recordSponsorInterest(actionId);
    showToast("Optional partner interest saved. No external action was taken.");
  }
}

approveButton.addEventListener("click", () => closeConfirmation(true));
cancelButton.addEventListener("click", () => closeConfirmation(false));
modal.addEventListener("click", (event) => {
  if (event.target === modal) closeConfirmation(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && pendingConfirmation) closeConfirmation(false);
});

for (const button of $$("[data-mode]")) {
  button.addEventListener("click", () => store.setMode(button.dataset.mode));
}

for (const button of $$("[data-phase]")) {
  button.addEventListener("click", () => {
    activePhase = button.dataset.phase;
    for (const candidate of $$("[data-phase]")) candidate.setAttribute("aria-selected", String(candidate === button));
    renderActions(store.getState());
  });
}

$("#action-list").addEventListener("click", (event) => {
  const completeButton = event.target.closest("[data-complete]");
  if (completeButton) completeFromInterface(completeButton.dataset.complete);
  const sponsorButton = event.target.closest("[data-sponsor]");
  if (sponsorButton) selectSponsorFromInterface(sponsorButton.dataset.sponsor);
});

$("#create-plan").addEventListener("click", async () => {
  const input = {
    availableMinutes: 45,
    experience: "first-time",
    accessibilityNeeds: "Prefer low-impact transitions and concise instructions.",
  };
  const approved = await confirmAction({
    eyebrow: "Personal layer",
    title: "Create this personal plan?",
    summary: "Prioritize official actions for 45 available minutes. The official guide will not change.",
    details: input,
    confirmLabel: "Create plan",
  });
  if (approved) {
    store.createPersonalPlan(input);
    showToast("Personal plan created without changing official truth.");
  }
});

$("#propose-sample").addEventListener("click", async () => {
  const input = {
    title: "Confirm hydration station locations",
    description: "Review the official hydration points and plan refills before entering transition.",
    phase: "before",
    required: true,
    estimatedMinutes: 4,
  };
  const approved = await confirmAction({
    eyebrow: "Organizer proposal",
    title: "Add this change to the review queue?",
    summary: "Prepare a new official action. It will remain unpublished until a second confirmation.",
    details: input,
    confirmLabel: "Add proposal",
  });
  if (approved) {
    store.proposeGuideAction(input);
    showToast("Proposal added. Official truth has not changed.");
  }
});

$("#validate-guide").addEventListener("click", () => {
  const result = store.validateGuide();
  showToast(result.valid ? `Guide valid: ${result.checkedActions} actions checked.` : `${result.issues.length} validation issues found.`);
});

$("#publish-changes").addEventListener("click", async () => {
  const state = store.getState();
  if (!state.pendingChanges.length) {
    showToast("There are no reviewed changes to publish.");
    return;
  }
  const approved = await confirmAction({
    eyebrow: "Official truth",
    title: "Publish reviewed changes?",
    summary: `Publish ${state.pendingChanges.length} pending change and create a new official version.`,
    details: { currentVersion: state.guide.version, pendingChanges: state.pendingChanges },
    confirmLabel: "Publish official version",
    danger: true,
  });
  if (approved) {
    const result = store.publishGuideChanges();
    showToast(`Official guide ${result.version} published with ${result.published} change.`);
  }
});

$("#undo-action").addEventListener("click", async () => {
  const approved = await confirmAction({
    eyebrow: "Recovery",
    title: "Undo the last confirmed change?",
    summary: "Restore the previous demo state and record the undo in the audit trail.",
    details: { reversibleDemoAction: true },
    confirmLabel: "Undo last change",
  });
  if (approved) {
    const result = store.undoLastMutation();
    showToast(result.status === "undone" ? `Undone: ${result.summary}` : "There is nothing to undo.");
  }
});

$("#reset-demo").addEventListener("click", async () => {
  const approved = await confirmAction({
    eyebrow: "Demo reset",
    title: "Return to the original synthetic state?",
    summary: "Clear personal plans, pending proposals, and demo activity.",
    details: { affectsProduction: false, syntheticDataOnly: true },
    confirmLabel: "Reset demo",
    danger: true,
  });
  if (approved) {
    activePhase = "all";
    store.reset();
    for (const candidate of $$("[data-phase]")) candidate.setAttribute("aria-selected", String(candidate.dataset.phase === "all"));
    showToast("The synthetic demo has been reset.");
  }
});

$("#prompt-list").addEventListener("click", (event) => {
  const chip = event.target.closest("[data-prompt]");
  if (chip) copyText(chip.dataset.prompt, "Prompt copied. Paste it into ChatGPT beside this page.");
});

$("#copy-demo-prompt").addEventListener("click", () =>
  copyText(
    "I have 45 minutes, this is my first event, and I prefer low-impact transitions. Read the official OCHECK guide, create my personal plan without changing official truth, then ask before completing any action.",
    "Winning demo prompt copied.",
  ),
);

store.subscribe(render);
render(store.getState());

const siteTools = buildSiteTools({ store, confirmAction });
renderToolCatalog(siteTools);
$("#registered-tool-count").textContent = siteTools.length;

registerSiteTools({
  tools: siteTools,
  onStatus: (status) => {
    $("#site-tools-status").textContent = status.supported ? "Site Tools active" : "Site Tools ready";
    $("#site-tools-detail").textContent = status.message;
    $("#status-dot").classList.toggle("active", status.supported && status.registered > 0);
    if (status.supported) $("#registered-tool-count").textContent = status.registered;
  },
}).catch((error) => {
  $("#site-tools-status").textContent = "Site Tools registration needs attention";
  $("#site-tools-detail").textContent = error instanceof Error ? error.message : String(error);
});

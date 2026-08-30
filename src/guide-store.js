import { freshInitialState } from "./demo-data.js";

const PHASE_ORDER = { before: 0, during: 1, after: 2 };

function clone(value) {
  return structuredClone(value);
}

function makeId(prefix) {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

export class GuideStore {
  constructor(seed = freshInitialState()) {
    this.state = clone(seed);
    this.listeners = new Set();
    this.undoStack = [];
  }

  getState() {
    return clone(this.state);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    const state = this.getState();
    for (const listener of this.listeners) listener(state);
  }

  setMode(mode) {
    if (!['participant', 'organizer'].includes(mode)) throw new Error("Mode must be participant or organizer.");
    this.state.mode = mode;
    this.emit();
    return { mode };
  }

  reset() {
    this.state = freshInitialState();
    this.undoStack = [];
    this.emit();
    return { status: "reset", guideId: this.state.guide.id };
  }

  progress() {
    const required = this.state.guide.actions.filter((action) => action.required);
    const completed = required.filter((action) => this.state.completedActionIds.includes(action.id));
    return {
      completed: completed.length,
      total: required.length,
      percent: required.length ? Math.round((completed.length / required.length) * 100) : 0,
    };
  }

  listActions({ phase = "all", query = "", requiredOnly = false } = {}) {
    const needle = query.trim().toLowerCase();
    return this.state.guide.actions
      .filter((action) => phase === "all" || action.phase === phase)
      .filter((action) => !requiredOnly || action.required)
      .filter((action) => !needle || `${action.title} ${action.description}`.toLowerCase().includes(needle))
      .sort((a, b) => PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase]);
  }

  validateGuide() {
    const issues = [];
    const ids = new Set();
    for (const action of this.state.guide.actions) {
      if (ids.has(action.id)) issues.push({ severity: "error", actionId: action.id, message: "Duplicate action id." });
      ids.add(action.id);
      if (action.critical && !action.deadline) {
        issues.push({ severity: "error", actionId: action.id, message: "Critical action needs a deadline." });
      }
      if (action.sponsored && !action.sponsored.disclosure) {
        issues.push({ severity: "error", actionId: action.id, message: "Sponsored action needs a disclosure." });
      }
      if (!action.title?.trim() || !action.description?.trim()) {
        issues.push({ severity: "error", actionId: action.id, message: "Every action needs a title and description." });
      }
    }
    for (const phase of Object.keys(PHASE_ORDER)) {
      if (!this.state.guide.actions.some((action) => action.phase === phase)) {
        issues.push({ severity: "warning", message: `The guide has no ${phase} actions.` });
      }
    }
    return {
      valid: !issues.some((issue) => issue.severity === "error"),
      issues,
      checkedActions: this.state.guide.actions.length,
      pendingChanges: this.state.pendingChanges.length,
    };
  }

  createPersonalPlan({ availableMinutes, experience, accessibilityNeeds = "" }) {
    const minutes = Number(availableMinutes);
    if (!Number.isFinite(minutes) || minutes < 5 || minutes > 240) {
      throw new Error("availableMinutes must be between 5 and 240.");
    }
    const allowedExperience = ["first-time", "intermediate", "experienced"];
    if (!allowedExperience.includes(experience)) throw new Error("Unsupported experience level.");

    const candidates = this.state.guide.actions
      .filter((action) => !this.state.completedActionIds.includes(action.id))
      .sort((a, b) => Number(b.critical) - Number(a.critical) || Number(b.required) - Number(a.required));

    let remaining = minutes;
    const selected = [];
    for (const action of candidates) {
      if (action.estimatedMinutes <= remaining || (action.critical && selected.length === 0)) {
        selected.push(action.id);
        remaining = Math.max(0, remaining - action.estimatedMinutes);
      }
    }

    return this.mutate("personal_plan_created", `Created a ${minutes}-minute personal plan`, () => {
      this.state.participant.availableMinutes = minutes;
      this.state.participant.experience = experience;
      this.state.participant.accessibilityNeeds = accessibilityNeeds.trim();
      this.state.personalPlan = selected;
      return {
        actionIds: selected,
        selectedActions: selected.map((id) => this.state.guide.actions.find((action) => action.id === id)),
        availableMinutes: minutes,
        unusedMinutes: remaining,
      };
    });
  }

  completeAction(actionId) {
    const action = this.state.guide.actions.find((candidate) => candidate.id === actionId);
    if (!action) throw new Error(`Unknown action: ${actionId}`);
    if (this.state.completedActionIds.includes(actionId)) {
      return { status: "already_completed", actionId, progress: this.progress() };
    }
    return this.mutate("action_completed", `Completed “${action.title}”`, () => {
      this.state.completedActionIds.push(actionId);
      return { status: "completed", actionId, title: action.title, progress: this.progress() };
    });
  }

  proposeGuideAction({ title, description, phase, required = true, estimatedMinutes = 5 }) {
    if (this.state.mode !== "organizer") throw new Error("Switch to Organizer Mode before proposing official changes.");
    if (!title?.trim() || !description?.trim()) throw new Error("A proposal needs a title and description.");
    if (!Object.hasOwn(PHASE_ORDER, phase)) throw new Error("phase must be before, during, or after.");
    const minutes = Number(estimatedMinutes);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 120) throw new Error("estimatedMinutes must be 1–120.");

    const proposal = {
      id: makeId("proposal"),
      operation: "add_action",
      action: {
        id: makeId("official"),
        title: title.trim(),
        description: description.trim(),
        phase,
        deadline: "To be confirmed by organizer",
        estimatedMinutes: minutes,
        required: Boolean(required),
        critical: false,
        official: true,
      },
      status: "pending",
    };
    return this.mutate("guide_change_proposed", `Proposed official action “${proposal.action.title}”`, () => {
      this.state.pendingChanges.push(proposal);
      return clone(proposal);
    });
  }

  publishGuideChanges() {
    if (this.state.mode !== "organizer") throw new Error("Switch to Organizer Mode before publishing.");
    if (!this.state.pendingChanges.length) return { status: "nothing_to_publish", published: 0 };
    const validation = this.validateGuide();
    if (!validation.valid) throw new Error("Resolve validation errors before publishing.");
    const count = this.state.pendingChanges.length;
    return this.mutate("guide_changes_published", `Published ${count} approved guide change${count === 1 ? "" : "s"}`, () => {
      for (const change of this.state.pendingChanges) {
        if (change.operation === "add_action") this.state.guide.actions.push(change.action);
      }
      this.state.pendingChanges = [];
      const [major, minor] = this.state.guide.version.split(".").map(Number);
      this.state.guide.version = `${major}.${minor + 1}`;
      this.state.guide.updatedAt = new Date().toISOString();
      return { status: "published", published: count, version: this.state.guide.version };
    });
  }

  recordSponsorInterest(actionId) {
    const action = this.state.guide.actions.find((candidate) => candidate.id === actionId && candidate.sponsored);
    if (!action) throw new Error("The selected action is not a disclosed sponsored action.");
    return this.mutate("sponsor_action_selected", `Selected optional partner action “${action.title}”`, () => {
      if (!this.state.sponsorEngagements.includes(actionId)) this.state.sponsorEngagements.push(actionId);
      return {
        status: "selected",
        actionId,
        partner: action.sponsored.partner,
        disclosure: action.sponsored.disclosure,
      };
    });
  }

  undoLastMutation() {
    const entry = this.undoStack.pop();
    if (!entry) return { status: "nothing_to_undo" };
    this.state = entry.snapshot;
    this.state.audit.unshift({
      id: makeId("audit"),
      at: new Date().toISOString(),
      actor: "human",
      kind: "mutation_undone",
      summary: `Undid: ${entry.summary}`,
    });
    this.emit();
    return { status: "undone", kind: entry.kind, summary: entry.summary, progress: this.progress() };
  }

  mutate(kind, summary, operation) {
    const snapshot = clone(this.state);
    const result = operation();
    this.undoStack.push({ kind, summary, snapshot });
    this.state.audit.unshift({
      id: makeId("audit"),
      at: new Date().toISOString(),
      actor: "human-confirmed action",
      kind,
      summary,
    });
    this.emit();
    return result;
  }
}

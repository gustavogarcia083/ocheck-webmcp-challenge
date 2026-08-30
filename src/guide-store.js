import { freshInitialState } from "./demo-data.js";

const PHASE_ORDER = { before: 0, during: 1, after: 2 };

function clone(value) {
  return structuredClone(value);
}

function makeId(prefix) {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function slugify(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || makeId("action");
}

function versionAfter(version) {
  const [major = 1, minor = 0] = String(version || "1.0").split(".").map(Number);
  return `${Number.isFinite(major) ? major : 1}.${Number.isFinite(minor) ? minor + 1 : 1}`;
}

function normalizeAction(action, index, seenIds) {
  const baseId = slugify(action.id || action.title || `action-${index + 1}`);
  let id = baseId;
  let suffix = 2;
  while (seenIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }
  seenIds.add(id);

  const sponsored = action.sponsored
    ? {
        partner: String(action.sponsored.partner || "").trim(),
        category: String(action.sponsored.category || "Contextual value").trim(),
        disclosure: String(action.sponsored.disclosure || "").trim(),
        headline: String(action.sponsored.headline || action.title || "").trim(),
        value: String(action.sponsored.value || "").trim(),
        ctaLabel: String(action.sponsored.ctaLabel || "Activate benefit").trim(),
        terms: String(action.sponsored.terms || "").trim(),
      }
    : undefined;

  return {
    id,
    phase: String(action.phase || "before"),
    title: String(action.title || "").trim(),
    description: String(action.description || "").trim(),
    deadline: String(action.deadline || "").trim(),
    estimatedMinutes: Number(action.estimatedMinutes || 5),
    required: Boolean(action.required),
    critical: Boolean(action.critical),
    official: !sponsored,
    completionEvidence: String(action.completionEvidence || "").trim(),
    sourceRef: String(action.sourceRef || "").trim(),
    ...(sponsored ? { sponsored } : {}),
  };
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
    if (!["participant", "organizer", "impact"].includes(mode)) {
      throw new Error("Mode must be participant, organizer, or impact.");
    }
    this.state.mode = mode;
    this.emit();
    return { mode };
  }

  updateBrief(raw) {
    this.state.brief.raw = String(raw || "");
    this.state.brief.updatedAt = new Date().toISOString();
    return { characters: this.state.brief.raw.length };
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

  readiness() {
    const required = this.state.guide.actions.filter((action) => action.required && action.phase === "before");
    const completed = required.filter((action) => this.state.completedActionIds.includes(action.id));
    const percent = required.length ? Math.round((completed.length / required.length) * 100) : 0;
    return {
      completed: completed.length,
      total: required.length,
      percent,
      status: percent === 100 ? "ready" : "in_progress",
      readyPassStatus: this.state.readyPass.status,
    };
  }

  listActions({ phase = "all", query = "", requiredOnly = false } = {}) {
    const needle = String(query).trim().toLowerCase();
    return this.state.guide.actions
      .filter((action) => phase === "all" || action.phase === phase)
      .filter((action) => !requiredOnly || action.required)
      .filter((action) => !needle || `${action.title} ${action.description} ${action.sourceRef}`.toLowerCase().includes(needle))
      .sort((a, b) => PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase]);
  }

  outcomeState() {
    const actions = this.state.guide.actions;
    const openRequired = actions
      .filter((action) => action.required && !this.state.completedActionIds.includes(action.id))
      .sort((a, b) => Number(b.critical) - Number(a.critical) || PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase]);
    const nextBestAction = openRequired[0] || null;
    const readiness = this.readiness();
    const currentPhase = readiness.percent < 100
      ? "before"
      : openRequired.find((action) => action.phase === "during")
        ? "during"
        : openRequired.length
          ? "after"
          : "complete";
    return {
      experienceIntegration: {
        role: "OCHECK is the official, organizer-governed and sponsor-enabled integrator of the experience.",
        replaces: "The participant reconciling scattered emails, chats, PDFs, maps, services, partner offers, and achievement moments.",
        authority: this.state.guide.organizer,
        integratedLayers: [
          "official truth",
          "personal AI assistance",
          "verified progress",
          "optional sponsored utility",
          "shareable verified achievement",
        ],
      },
      outcome: this.state.guide.outcome,
      definitionOfDone: this.state.guide.definitionOfDone,
      currentPhase,
      nextBestAction,
      openLoops: openRequired.map((action) => ({
        id: action.id,
        title: action.title,
        phase: action.phase,
        critical: action.critical,
        deadline: action.deadline,
      })),
      readiness,
      progress: this.progress(),
      personalPlan: clone(this.state.personalPlan),
      readyPass: clone(this.state.readyPass),
      guideVersion: this.state.guide.version,
    };
  }

  validateDraft(draft = this.state.creation.draft) {
    if (!draft) {
      return {
        valid: false,
        score: 0,
        issues: [{ severity: "error", field: "draft", message: "No AI-generated draft has been staged." }],
        checkedActions: 0,
      };
    }

    const issues = [];
    if (!draft.title?.trim()) issues.push({ severity: "error", field: "title", message: "The guide needs a title." });
    if (!draft.outcome?.trim()) issues.push({ severity: "error", field: "outcome", message: "The guide needs an explicit outcome." });
    if (!draft.definitionOfDone?.trim()) {
      issues.push({ severity: "error", field: "definitionOfDone", message: "The outcome needs a definition of done." });
    }
    if (!draft.sourceLabel?.trim()) {
      issues.push({ severity: "error", field: "sourceLabel", message: "The official source must be identified." });
    }
    if (!Array.isArray(draft.actions) || !draft.actions.length) {
      issues.push({ severity: "error", field: "actions", message: "The guide needs at least one action." });
    }

    const ids = new Set();
    for (const action of draft.actions || []) {
      if (ids.has(action.id)) issues.push({ severity: "error", actionId: action.id, message: "Duplicate action id." });
      ids.add(action.id);
      if (!Object.hasOwn(PHASE_ORDER, action.phase)) {
        issues.push({ severity: "error", actionId: action.id, message: "Action phase must be before, during, or after." });
      }
      if (!action.title?.trim() || !action.description?.trim()) {
        issues.push({ severity: "error", actionId: action.id, message: "Every action needs a title and instruction." });
      }
      if (action.critical && !action.deadline?.trim()) {
        issues.push({ severity: "error", actionId: action.id, message: "Critical actions need a deadline." });
      }
      if (!action.completionEvidence?.trim()) {
        issues.push({ severity: "error", actionId: action.id, message: "Every action needs verifiable completion evidence." });
      }
      if (!action.sourceRef?.trim()) {
        issues.push({ severity: "error", actionId: action.id, message: "Every action must trace to a source." });
      }
      if (action.sponsored) {
        if (!action.sponsored.partner || !action.sponsored.disclosure || !action.sponsored.value || !action.sponsored.terms) {
          issues.push({ severity: "error", actionId: action.id, message: "Sponsored actions need partner, disclosure, value, and terms." });
        }
        if (action.required) {
          issues.push({ severity: "error", actionId: action.id, message: "A sponsored action cannot be required." });
        }
      }
    }

    for (const phase of Object.keys(PHASE_ORDER)) {
      if (!(draft.actions || []).some((action) => action.phase === phase)) {
        issues.push({ severity: phase === "before" ? "error" : "warning", field: "actions", message: `The guide has no ${phase} actions.` });
      }
    }
    if (!draft.readyPass?.title || !draft.readyPass?.unlockRule || !draft.readyPass?.benefit) {
      issues.push({ severity: "error", field: "readyPass", message: "The experience needs a named Ready Pass, verified unlock rule, and participant benefit." });
    }
    for (const question of draft.openQuestions || []) {
      if (String(question).trim()) issues.push({ severity: "warning", field: "openQuestions", message: String(question).trim() });
    }

    const errors = issues.filter((issue) => issue.severity === "error").length;
    const warnings = issues.filter((issue) => issue.severity === "warning").length;
    return {
      valid: errors === 0,
      score: Math.max(0, 100 - errors * 15 - warnings * 4),
      issues,
      errors,
      warnings,
      checkedActions: draft.actions?.length || 0,
      sponsorOpportunities: (draft.actions || []).filter((action) => action.sponsored).length,
    };
  }

  validateOfficialGuide() {
    return this.validateDraft({
      ...this.state.guide,
      readyPass: this.state.readyPass,
      openQuestions: [],
    });
  }

  stageGeneratedGuide(input) {
    if (this.state.mode !== "organizer") throw new Error("Switch to Organizer + AI before staging an official guide.");
    const seenIds = new Set();
    const draft = {
      title: String(input.title || "").trim(),
      organizer: String(input.organizer || "").trim(),
      outcome: String(input.outcome || "").trim(),
      definitionOfDone: String(input.definitionOfDone || "").trim(),
      eventDate: String(input.eventDate || "").trim(),
      location: String(input.location || "").trim(),
      sourceLabel: String(input.sourceLabel || this.state.brief.source || "").trim(),
      actions: Array.isArray(input.actions) ? input.actions.map((action, index) => normalizeAction(action, index, seenIds)) : [],
      assumptions: Array.isArray(input.assumptions) ? input.assumptions.map(String).filter(Boolean) : [],
      openQuestions: Array.isArray(input.openQuestions) ? input.openQuestions.map(String).filter(Boolean) : [],
      readyPass: {
        title: String(input.readyPass?.title || "").trim(),
        unlockRule: String(input.readyPass?.unlockRule || "").trim(),
        benefit: String(input.readyPass?.benefit || "").trim(),
      },
      stagedAt: new Date().toISOString(),
      generatedFromBriefId: this.state.brief.id,
    };
    return this.mutate("ai_guide_staged", `Staged AI-generated guide “${draft.title || "Untitled"}”`, () => {
      this.state.creation.draft = draft;
      this.state.creation.validation = null;
      return { status: "staged", draft: clone(draft), validation: this.validateDraft(draft) };
    }, "agent proposal · human confirmed");
  }

  publishDraft() {
    if (this.state.mode !== "organizer") throw new Error("Switch to Organizer + AI before publishing.");
    const draft = this.state.creation.draft;
    if (!draft) throw new Error("Stage an AI-generated guide before publishing.");
    const validation = this.validateDraft(draft);
    if (!validation.valid) throw new Error("Resolve every blocking validation issue before publishing.");

    return this.mutate("official_guide_published", `Published AI-generated guide “${draft.title}”`, () => {
      const previousCompleted = new Set(this.state.completedActionIds);
      this.state.guide = {
        id: this.state.guide.id,
        title: draft.title,
        organizer: draft.organizer,
        outcome: draft.outcome,
        definitionOfDone: draft.definitionOfDone,
        eventDate: draft.eventDate,
        location: draft.location,
        sourceLabel: draft.sourceLabel,
        status: "published",
        version: versionAfter(this.state.guide.version),
        updatedAt: new Date().toISOString(),
        actions: clone(draft.actions),
      };
      this.state.completedActionIds = draft.actions.filter((action) => previousCompleted.has(action.id)).map((action) => action.id);
      this.state.personalPlan = [];
      this.state.sponsorEngagements = [];
      this.state.readyPass = {
        id: `ready-pass-${slugify(draft.title)}`,
        title: draft.readyPass.title,
        status: "locked",
        unlockRule: draft.readyPass.unlockRule,
        benefit: draft.readyPass.benefit,
        code: null,
        referralCode: null,
        claimedAt: null,
      };
      if (this.readiness().percent === 100) this.state.readyPass.status = "available";
      return {
        status: "published",
        version: this.state.guide.version,
        actions: this.state.guide.actions.length,
        preservedCompletions: this.state.completedActionIds.length,
        validation,
      };
    }, "organizer · human confirmed");
  }

  createPersonalPlan({ availableMinutes, experience, accessibilityNeeds = "", includeSponsored = false }) {
    const minutes = Number(availableMinutes);
    if (!Number.isFinite(minutes) || minutes < 5 || minutes > 240) {
      throw new Error("availableMinutes must be between 5 and 240.");
    }
    const allowedExperience = ["first-time", "intermediate", "experienced"];
    if (!allowedExperience.includes(experience)) throw new Error("Unsupported experience level.");

    const candidates = this.state.guide.actions
      .filter((action) => !this.state.completedActionIds.includes(action.id))
      .filter((action) => !action.sponsored || includeSponsored)
      .sort((a, b) => Number(b.critical) - Number(a.critical) || Number(b.required) - Number(a.required) || PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase]);

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
      this.state.participant.accessibilityNeeds = String(accessibilityNeeds).trim();
      this.state.personalPlan = selected;
      return {
        status: "created",
        actionIds: selected,
        selectedActions: selected.map((id) => this.state.guide.actions.find((action) => action.id === id)),
        availableMinutes: minutes,
        unusedMinutes: remaining,
        officialGuideChanged: false,
      };
    });
  }

  completeAction(actionId) {
    const action = this.state.guide.actions.find((candidate) => candidate.id === actionId);
    if (!action) throw new Error(`Unknown action: ${actionId}`);
    if (this.state.completedActionIds.includes(actionId)) {
      return { status: "already_completed", actionId, progress: this.progress(), readiness: this.readiness() };
    }

    const readyPassWasLocked = this.state.readyPass.status === "locked";
    return this.mutate("action_completed", `Completed “${action.title}”`, () => {
      this.state.completedActionIds.push(actionId);
      const readiness = this.readiness();
      let readyPassUnlocked = false;
      if (readyPassWasLocked && readiness.percent === 100) {
        this.state.readyPass.status = "available";
        this.state.impact.readyPasses += 1;
        readyPassUnlocked = true;
      }
      return {
        status: "completed",
        actionId,
        title: action.title,
        progress: this.progress(),
        readiness: this.readiness(),
        readyPassUnlocked,
        readyPass: clone(this.state.readyPass),
      };
    });
  }

  activateSponsorBenefit(actionId) {
    const action = this.state.guide.actions.find((candidate) => candidate.id === actionId && candidate.sponsored);
    if (!action) throw new Error("The selected action is not a disclosed sponsored opportunity.");
    const existing = this.state.sponsorEngagements.find((entry) => entry.actionId === actionId);
    if (existing) return { status: "already_activated", ...clone(existing) };

    return this.mutate("sponsor_benefit_activated", `Activated optional partner benefit “${action.title}”`, () => {
      const engagement = {
        actionId,
        partner: action.sponsored.partner,
        disclosure: action.sponsored.disclosure,
        value: action.sponsored.value,
        status: "activated",
        demoCode: "MOTION-DEMO-15",
        activatedAt: new Date().toISOString(),
        purchaseMade: false,
      };
      this.state.sponsorEngagements.push(engagement);
      this.state.impact.sponsorActivations += 1;
      return { status: "activated", ...clone(engagement) };
    });
  }

  claimReadyPass() {
    if (this.state.readyPass.status === "locked") {
      throw new Error("Complete every required Before action before claiming the Ready Pass.");
    }
    if (this.state.readyPass.status === "claimed") {
      return { status: "already_claimed", readyPass: clone(this.state.readyPass) };
    }
    return this.mutate("ready_pass_claimed", `Claimed “${this.state.readyPass.title}”`, () => {
      this.state.readyPass.status = "claimed";
      this.state.readyPass.code = "READY-5150-DEMO";
      this.state.readyPass.referralCode = "ready-coastal-5150";
      this.state.readyPass.claimedAt = new Date().toISOString();
      return {
        status: "claimed",
        readyPass: clone(this.state.readyPass),
        referralPath: "/?ref=ready-coastal-5150&utm_source=ocheck_ready_pass",
        createsNewRecipientState: true,
      };
    });
  }

  commercialImpact() {
    const impact = clone(this.state.impact);
    const percent = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);
    const sponsorOpenRate = percent(impact.sponsorActionOpens, impact.sponsorImpressions);
    const sponsorActivationRate = percent(impact.sponsorActivations, impact.sponsorActionOpens);
    const verifiedIntentRate = percent(impact.sponsorActivations, impact.sponsorImpressions);
    const readyPassReferralRate = percent(impact.referredStarts, impact.readyPassShares);
    return {
      ...impact,
      officialIntegration: {
        before: "Customer as accidental integrator of fragmented touchpoints.",
        after: "OCHECK as the official, organizer-governed and sponsor-enabled experience integrator.",
        sourceTypes: ["email", "chat", "PDF", "map", "service", "partner offer", "achievement moment"],
        governedBy: this.state.guide.organizer,
        integratedActors: ["organizer", "participant", "AI agent", "authorized partner"],
      },
      readinessRate: percent(impact.readyPasses, impact.activeParticipants),
      sponsorOpenRate,
      sponsorActivationRate,
      verifiedIntentRate,
      readyPassReferralRate,
      hooks: {
        customerExperience: {
          promise: "One official source integrates rules, timing, personal assistance, verified progress, useful optional value, and shareable achievement so the customer does not have to.",
          currentReadyPassStatus: this.state.readyPass.status,
        },
        eventVirality: {
          mechanism: "Verified readiness → shareable Ready Pass → clean referred guide start.",
          readyPassShares: impact.readyPassShares,
          cleanReferredStarts: impact.referredStarts,
          shareToStartRate: readyPassReferralRate,
        },
        sponsorAccuracy: {
          mechanism: "Contextual need → disclosed offer open → explicit opt-in.",
          contextualOpens: impact.sponsorActionOpens,
          verifiedIntentSignals: impact.sponsorActivations,
          verifiedIntentRate,
          signalBasis: ["need-matched action open", "explicit benefit activation"],
          accuracyPrinciple: "Real contextual actions support a more accurate understanding of customer intent than impressions alone; this demo does not claim demographic or predictive accuracy.",
          privacyBoundary: "Metrics are aggregated and non-identifying. Partners receive no participant identity, contact data, or personal progress.",
        },
      },
      disclosure: "All dashboard figures are synthetic challenge data. This demo requires no participant account and exposes only aggregate, non-identifying sponsor metrics.",
      currentDemoEngagements: clone(this.state.sponsorEngagements),
    };
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
    return {
      status: "undone",
      kind: entry.kind,
      summary: entry.summary,
      progress: this.progress(),
      readiness: this.readiness(),
      readyPass: clone(this.state.readyPass),
    };
  }

  mutate(kind, summary, operation, actor = "human-confirmed action") {
    const snapshot = clone(this.state);
    const result = operation();
    this.undoStack.push({ kind, summary, snapshot });
    this.state.audit.unshift({
      id: makeId("audit"),
      at: new Date().toISOString(),
      actor,
      kind,
      summary,
    });
    this.emit();
    return result;
  }
}

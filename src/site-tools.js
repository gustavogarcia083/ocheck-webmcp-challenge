function objectSchema(properties = {}, required = []) {
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

function textProperty(description, extras = {}) {
  return { type: "string", description, ...extras };
}

async function confirmOrCancel(confirmAction, request) {
  const approved = await confirmAction(request);
  if (!approved) return { approved: false, result: { status: "cancelled", message: "The user cancelled the proposed action." } };
  return { approved: true };
}

export function buildSiteTools({ store, confirmAction }) {
  return [
    {
      name: "get_guide_state",
      description: "Read the current official guide, demo role, participant context, progress, personal plan, pending organizer changes, and recent audit activity.",
      inputSchema: objectSchema(),
      annotations: { readOnlyHint: true },
      execute: async () => {
        const state = store.getState();
        return { ...state, progress: store.progress() };
      },
    },
    {
      name: "find_official_actions",
      description: "Find official guide actions by phase, text, or required status without changing the guide.",
      inputSchema: objectSchema({
        phase: textProperty("Filter by guide phase.", { enum: ["all", "before", "during", "after"], default: "all" }),
        query: textProperty("Optional search text.", { default: "" }),
        requiredOnly: { type: "boolean", description: "Return required actions only.", default: false },
      }),
      annotations: { readOnlyHint: true },
      execute: async ({ phase = "all", query = "", requiredOnly = false } = {}) => ({
        actions: store.listActions({ phase, query, requiredOnly }),
      }),
    },
    {
      name: "get_participant_progress",
      description: "Read completion totals, remaining required actions, and the participant's current personal plan.",
      inputSchema: objectSchema(),
      annotations: { readOnlyHint: true },
      execute: async () => {
        const state = store.getState();
        return {
          participant: state.participant,
          progress: store.progress(),
          remainingRequired: state.guide.actions.filter((action) => action.required && !state.completedActionIds.includes(action.id)),
          personalPlan: state.personalPlan,
        };
      },
    },
    {
      name: "get_sponsor_actions",
      description: "Read optional, clearly disclosed sponsored actions and their user value. This never selects or opens a commercial action.",
      inputSchema: objectSchema(),
      annotations: { readOnlyHint: true },
      execute: async () => ({ actions: store.getState().guide.actions.filter((action) => action.sponsored) }),
    },
    {
      name: "validate_official_guide",
      description: "Check the official guide for duplicate identifiers, missing critical deadlines, missing sponsorship disclosures, empty content, and phase coverage.",
      inputSchema: objectSchema(),
      annotations: { readOnlyHint: true },
      execute: async () => store.validateGuide(),
    },
    {
      name: "create_personal_plan",
      description: "Create a personal action plan from the official guide using the participant's available time, experience, and accessibility needs. This changes only the personal layer and requires human confirmation.",
      inputSchema: objectSchema({
        availableMinutes: { type: "number", minimum: 5, maximum: 240, description: "Minutes available for preparation." },
        experience: textProperty("Participant experience level.", { enum: ["first-time", "intermediate", "experienced"] }),
        accessibilityNeeds: textProperty("Optional accessibility or pacing needs.", { default: "" }),
      }, ["availableMinutes", "experience"]),
      execute: async (input) => {
        const decision = await confirmOrCancel(confirmAction, {
          eyebrow: "Personal layer",
          title: "Create this personal plan?",
          summary: `Prioritize official actions for ${input.availableMinutes} available minutes. The official guide will not change.`,
          details: input,
          confirmLabel: "Create plan",
        });
        return decision.approved ? store.createPersonalPlan(input) : decision.result;
      },
    },
    {
      name: "complete_guide_action",
      description: "Mark one existing guide action complete after explicit human confirmation and return updated verified progress.",
      inputSchema: objectSchema({
        actionId: textProperty("Exact action id from the official guide."),
      }, ["actionId"]),
      execute: async ({ actionId }) => {
        const action = store.getState().guide.actions.find((candidate) => candidate.id === actionId);
        if (!action) throw new Error(`Unknown action: ${actionId}`);
        const decision = await confirmOrCancel(confirmAction, {
          eyebrow: "Verified progress",
          title: "Confirm completion?",
          summary: `Mark “${action.title}” as completed and update visible progress.`,
          details: { actionId, title: action.title, official: action.official },
          confirmLabel: "Confirm completion",
        });
        return decision.approved ? store.completeAction(actionId) : decision.result;
      },
    },
    {
      name: "select_sponsor_action",
      description: "Record interest in a clearly disclosed optional sponsored action. This never makes a purchase or opens an external destination and requires confirmation.",
      inputSchema: objectSchema({ actionId: textProperty("Exact id of a sponsored action.") }, ["actionId"]),
      execute: async ({ actionId }) => {
        const action = store.getState().guide.actions.find((candidate) => candidate.id === actionId && candidate.sponsored);
        if (!action) throw new Error("Select an action returned by get_sponsor_actions.");
        const decision = await confirmOrCancel(confirmAction, {
          eyebrow: "Clearly disclosed partner action",
          title: "Save interest in this option?",
          summary: `${action.sponsored.partner} offers: ${action.sponsored.value}. No purchase will be made.`,
          details: { actionId, disclosure: action.sponsored.disclosure, optional: true },
          confirmLabel: "Save interest",
        });
        return decision.approved ? store.recordSponsorInterest(actionId) : decision.result;
      },
    },
    {
      name: "propose_official_action",
      description: "In Organizer Mode, prepare a new official guide action as a pending proposal. It does not publish or alter official truth and requires human confirmation.",
      inputSchema: objectSchema({
        title: textProperty("Short action title."),
        description: textProperty("Clear participant-facing instruction."),
        phase: textProperty("Guide phase.", { enum: ["before", "during", "after"] }),
        required: { type: "boolean", description: "Whether the action is required.", default: true },
        estimatedMinutes: { type: "number", minimum: 1, maximum: 120, description: "Estimated completion time." },
      }, ["title", "description", "phase", "estimatedMinutes"]),
      execute: async (input) => {
        const decision = await confirmOrCancel(confirmAction, {
          eyebrow: "Organizer proposal",
          title: "Add this change to the review queue?",
          summary: `Prepare “${input.title}” as a pending ${input.phase} action. It will not be published yet.`,
          details: input,
          confirmLabel: "Add proposal",
        });
        return decision.approved ? store.proposeGuideAction(input) : decision.result;
      },
    },
    {
      name: "publish_approved_changes",
      description: "In Organizer Mode, publish all pending reviewed changes into the official guide. This changes official truth, increments the version, and requires explicit human confirmation.",
      inputSchema: objectSchema(),
      execute: async () => {
        const state = store.getState();
        const decision = await confirmOrCancel(confirmAction, {
          eyebrow: "Official truth",
          title: "Publish reviewed changes?",
          summary: `Publish ${state.pendingChanges.length} pending change${state.pendingChanges.length === 1 ? "" : "s"} and create a new official guide version.`,
          details: { pendingChanges: state.pendingChanges, currentVersion: state.guide.version },
          confirmLabel: "Publish official version",
          danger: true,
        });
        return decision.approved ? store.publishGuideChanges() : decision.result;
      },
    },
    {
      name: "undo_last_confirmed_action",
      description: "Undo the last reversible confirmed mutation in this demo after human confirmation.",
      inputSchema: objectSchema(),
      execute: async () => {
        const decision = await confirmOrCancel(confirmAction, {
          eyebrow: "Recovery",
          title: "Undo the last confirmed change?",
          summary: "Restore the previous demo state and record the undo in the audit trail.",
          details: { reversibleDemoAction: true },
          confirmLabel: "Undo last change",
        });
        return decision.approved ? store.undoLastMutation() : decision.result;
      },
    },
  ];
}

export async function registerSiteTools({ tools, onStatus }) {
  if (typeof document.modelContext?.registerTool !== "function") {
    onStatus?.({ supported: false, registered: 0, message: "Open this page in ChatGPT’s built-in browser to activate Site Tools." });
    return { supported: false, registered: 0 };
  }

  let registered = 0;
  const failures = [];
  for (const tool of tools) {
    try {
      await document.modelContext.registerTool(tool);
      registered += 1;
    } catch (error) {
      failures.push({ name: tool.name, message: error instanceof Error ? error.message : String(error) });
    }
  }
  const status = {
    supported: true,
    registered,
    failures,
    message: failures.length ? `${registered} Site Tools active; ${failures.length} failed.` : `${registered} Site Tools active in this page.`,
  };
  onStatus?.(status);
  return status;
}

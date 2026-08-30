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

function actionInputSchema() {
  return objectSchema({
    id: textProperty("Optional stable action id. If omitted, OCHECK creates one from the title."),
    title: textProperty("Short participant-facing action title."),
    description: textProperty("Clear instruction explaining what the participant must do."),
    phase: textProperty("Outcome phase.", { enum: ["before", "during", "after"] }),
    deadline: textProperty("Specific deadline or timing rule. Required for critical actions."),
    estimatedMinutes: { type: "number", minimum: 1, maximum: 240, description: "Estimated minutes to complete the action." },
    required: { type: "boolean", description: "Whether this action is required to complete the official path." },
    critical: { type: "boolean", description: "Whether missing this action creates material risk." },
    completionEvidence: textProperty("Observable evidence that lets the user verify completion."),
    sourceRef: textProperty("Official source, rule, section, or organizer statement supporting the action."),
    sponsored: objectSchema({
      partner: textProperty("Synthetic or authorized partner name."),
      category: textProperty("Value category, such as mobility or recovery."),
      disclosure: textProperty("Visible disclosure that this is sponsored."),
      headline: textProperty("Concise user-benefit headline."),
      value: textProperty("Specific optional value delivered to the user."),
      ctaLabel: textProperty("Human-readable activation label."),
      terms: textProperty("Terms confirming optionality and whether any purchase is required."),
    }, ["partner", "disclosure", "value", "terms"]),
  }, ["title", "description", "phase", "estimatedMinutes", "required", "critical", "completionEvidence", "sourceRef"]);
}

async function confirmOrCancel(confirmAction, request) {
  const approved = await confirmAction(request);
  if (!approved) {
    return {
      approved: false,
      result: { status: "cancelled", message: "The person cancelled the proposed action. No state changed." },
    };
  }
  return { approved: true };
}

export function buildSiteTools({ store, confirmAction }) {
  return [
    {
      name: "get_outcome_state",
      description: "Read OCHECK's official integrated experience: organizer authority, intended result, definition of done, current phase, next best action, open loops, verified progress, personal plan, sponsored utility, and Ready Pass state.",
      inputSchema: objectSchema(),
      annotations: { readOnlyHint: true },
      execute: async () => {
        const state = store.getState();
        return {
          guide: {
            id: state.guide.id,
            title: state.guide.title,
            organizer: state.guide.organizer,
            sourceLabel: state.guide.sourceLabel,
            status: state.guide.status,
            version: state.guide.version,
          },
          ...store.outcomeState(),
        };
      },
    },
    {
      name: "get_creation_brief",
      description: "Read the organizer's scattered emails, messages, requirements, partner proposals, and open ideas that must become one official, sequenced, verifiable experience. This never changes the brief or guide.",
      inputSchema: objectSchema(),
      annotations: { readOnlyHint: true },
      execute: async () => {
        const state = store.getState();
        return {
          brief: state.brief,
          currentDraft: state.creation.draft,
          expectedOutput: {
            integration: "How scattered sources, actors, services, sponsor value, and achievement moments become one organizer-governed official experience.",
            outcome: "A single explicit result.",
            definitionOfDone: "Observable completion conditions.",
            actions: "Sequenced before, during, and after actions with evidence and sources.",
            openQuestions: "Anything the organizer must still resolve.",
            commerce: "Optional disclosed value placed at a real need; opens and explicit opt-ins become high-intent signals without changing completion.",
            readyPass: "A shareable proof of verified preparation whose clean referral can turn satisfaction into event reach.",
          },
        };
      },
    },
    {
      name: "validate_guide_draft",
      description: "Validate the staged AI guide without changing it. Checks outcome clarity, definition of done, phases, critical deadlines, completion evidence, source traceability, sponsorship disclosure, optionality, Ready Pass logic, and unresolved questions.",
      inputSchema: objectSchema(),
      annotations: { readOnlyHint: true },
      execute: async () => store.validateDraft(),
    },
    {
      name: "get_participant_progress",
      description: "Read verified participant progress, readiness for the outcome, remaining required actions, personal plan, and Ready Pass eligibility.",
      inputSchema: objectSchema(),
      annotations: { readOnlyHint: true },
      execute: async () => {
        const state = store.getState();
        return {
          participant: state.participant,
          progress: store.progress(),
          readiness: store.readiness(),
          remainingRequired: state.guide.actions.filter((action) => action.required && !state.completedActionIds.includes(action.id)),
          personalPlan: state.personalPlan,
          readyPass: state.readyPass,
        };
      },
    },
    {
      name: "get_sponsor_opportunities",
      description: "Read optional, clearly disclosed sponsored actions, their contextual user value, and the aggregate high-intent signal an explicit activation would create. This never activates a benefit, makes a purchase, changes completion, or exposes participant identity, contact data, or personal progress.",
      inputSchema: objectSchema(),
      annotations: { readOnlyHint: true },
      execute: async () => {
        const state = store.getState();
        return {
          opportunities: state.guide.actions.filter((action) => action.sponsored),
          existingEngagements: state.sponsorEngagements,
          principle: "Commercial interaction and official completion are independent. Aggregated context plus explicit opt-in supports more accurate customer-intent understanding than impressions alone.",
          privacy: "No participant account is required in this demo. Partners receive aggregate, non-identifying metrics—not identity, contact data, or personal progress.",
        };
      },
    },
    {
      name: "get_commercial_impact",
      description: "Read how OCHECK replaces customer self-integration with one official experience, then inspect its synthetic dual-hook impact: readiness, satisfaction-led achievement sharing, aggregate contextual sponsor interest, explicit high-intent opt-ins, and clean referral starts.",
      inputSchema: objectSchema(),
      annotations: { readOnlyHint: true },
      execute: async () => store.commercialImpact(),
    },
    {
      name: "stage_ai_guide_draft",
      description: "In Organizer + AI mode, integrate scattered sources, actors, services, optional sponsor value, and a shareable Ready Pass into one proposed organizer-governed official experience. This stages a visible draft only; it does not publish. It requires human confirmation.",
      inputSchema: objectSchema({
        title: textProperty("Official guide title."),
        organizer: textProperty("Organization responsible for the official truth."),
        outcome: textProperty("The result this guide helps people achieve."),
        definitionOfDone: textProperty("Observable conditions that prove the result was achieved."),
        eventDate: textProperty("Event or target date."),
        location: textProperty("Event location or operating context."),
        sourceLabel: textProperty("Official source used to construct the guide."),
        actions: {
          type: "array",
          minItems: 1,
          maxItems: 20,
          description: "Sequenced official and optional sponsored actions.",
          items: actionInputSchema(),
        },
        assumptions: {
          type: "array",
          maxItems: 10,
          description: "Explicit assumptions made while interpreting the brief.",
          items: { type: "string" },
        },
        openQuestions: {
          type: "array",
          maxItems: 10,
          description: "Unresolved questions the organizer must answer.",
          items: { type: "string" },
        },
        readyPass: objectSchema({
          title: textProperty("Name of the shareable Ready Pass."),
          unlockRule: textProperty("Exact verified condition that unlocks it."),
          benefit: textProperty("Satisfaction, recognition, and sharing value delivered to the participant."),
          sponsor: textProperty("Optional synthetic or authorized supporting partner."),
        }, ["title", "unlockRule", "benefit"]),
      }, ["title", "organizer", "outcome", "definitionOfDone", "eventDate", "location", "sourceLabel", "actions", "readyPass"]),
      execute: async (input) => {
        const decision = await confirmOrCancel(confirmAction, {
          eyebrow: "AI Guide Forge · Human review",
          title: "Stage this AI-generated official guide?",
          summary: `Integrate the scattered brief into a visible official-experience draft with ${input.actions.length} actions, ${input.openQuestions?.length || 0} open questions, an optional relevance hook, and a satisfaction hook built around the Ready Pass. Nothing will be published yet.`,
          details: {
            title: input.title,
            outcome: input.outcome,
            definitionOfDone: input.definitionOfDone,
            actions: input.actions.map((action) => ({ title: action.title, phase: action.phase, required: action.required, sponsored: Boolean(action.sponsored) })),
            openQuestions: input.openQuestions || [],
            readyPass: input.readyPass,
          },
          confirmLabel: "Stage AI draft",
        });
        return decision.approved ? store.stageGeneratedGuide(input) : decision.result;
      },
    },
    {
      name: "publish_official_guide",
      description: "In Organizer + AI mode, activate the staged integration layer as the official experience only after validation and explicit human confirmation. This replaces official guide content, increments the version, and preserves matching verified completions.",
      inputSchema: objectSchema(),
      execute: async () => {
        const state = store.getState();
        const validation = store.validateDraft();
        const decision = await confirmOrCancel(confirmAction, {
          eyebrow: "Official truth · Consequential action",
          title: "Publish this validated guide?",
          summary: `Publish “${state.creation.draft?.title || "Untitled"}” as official version ${state.guide.version} → next version. Validation score: ${validation.score}/100.`,
          details: {
            currentVersion: state.guide.version,
            validation,
            draft: state.creation.draft,
          },
          confirmLabel: "Publish official guide",
          danger: true,
        });
        return decision.approved ? store.publishDraft() : decision.result;
      },
    },
    {
      name: "create_personal_plan",
      description: "Create a personal execution plan inside the official experience using time, experience, and accessibility context. It never rewrites official truth and requires human confirmation.",
      inputSchema: objectSchema({
        availableMinutes: { type: "number", minimum: 5, maximum: 240, description: "Minutes available for this preparation session." },
        experience: textProperty("Participant experience level.", { enum: ["first-time", "intermediate", "experienced"] }),
        accessibilityNeeds: textProperty("Accessibility, pacing, or instruction preferences."),
        includeSponsored: { type: "boolean", description: "Whether optional sponsored value may appear in the personal plan.", default: false },
      }, ["availableMinutes", "experience"]),
      execute: async (input) => {
        const decision = await confirmOrCancel(confirmAction, {
          eyebrow: "Personal Assist · Human confirmation",
          title: "Create this personal plan?",
          summary: `Prioritize official actions for ${input.availableMinutes} available minutes without changing the guide.`,
          details: input,
          confirmLabel: "Create personal plan",
        });
        return decision.approved ? store.createPersonalPlan(input) : decision.result;
      },
    },
    {
      name: "complete_guide_action",
      description: "Mark one existing guide action complete after explicit human confirmation. Updates visible verified progress and may unlock the Ready Pass achievement.",
      inputSchema: objectSchema({
        actionId: textProperty("Exact action id from the current official guide."),
      }, ["actionId"]),
      execute: async ({ actionId }) => {
        const action = store.getState().guide.actions.find((candidate) => candidate.id === actionId);
        if (!action) throw new Error(`Unknown action: ${actionId}`);
        const decision = await confirmOrCancel(confirmAction, {
          eyebrow: "Verified Progress · Human confirmation",
          title: "Confirm this completed action?",
          summary: `Mark “${action.title}” complete using its evidence rule: ${action.completionEvidence}`,
          details: { actionId, title: action.title, official: action.official, evidence: action.completionEvidence },
          confirmLabel: "Confirm completion",
        });
        return decision.approved ? store.completeAction(actionId) : decision.result;
      },
    },
    {
      name: "activate_sponsor_benefit",
      description: "Activate one optional, disclosed synthetic partner benefit after human confirmation. It records a contextual high-intent signal only, makes no purchase, opens no external destination, shares no personal progress, and never completes a required action.",
      inputSchema: objectSchema({
        actionId: textProperty("Exact id returned by get_sponsor_opportunities."),
      }, ["actionId"]),
      execute: async ({ actionId }) => {
        const action = store.getState().guide.actions.find((candidate) => candidate.id === actionId && candidate.sponsored);
        if (!action) throw new Error("Select an action returned by get_sponsor_opportunities.");
        const decision = await confirmOrCancel(confirmAction, {
          eyebrow: "Sponsored utility · Human confirmation",
          title: "Activate this optional demo benefit?",
          summary: `${action.sponsored.partner} offers ${action.sponsored.value}. This records one synthetic high-intent opt-in; no purchase will be made and official completion will not change.`,
          details: {
            actionId,
            disclosure: action.sponsored.disclosure,
            value: action.sponsored.value,
            terms: action.sponsored.terms,
            purchaseMade: false,
          },
          confirmLabel: "Activate demo benefit",
        });
        return decision.approved ? store.activateSponsorBenefit(actionId) : decision.result;
      },
    },
    {
      name: "claim_ready_pass",
      description: "Claim the OCHECK Ready Pass only after every required Before action is verified. Creates a synthetic verification code and clean referral path—the satisfaction and event-reach hook—after human confirmation; it makes no purchase and transfers no personal progress.",
      inputSchema: objectSchema(),
      execute: async () => {
        const state = store.getState();
        const readiness = store.readiness();
        const decision = await confirmOrCancel(confirmAction, {
          eyebrow: "Verified result · Human confirmation",
          title: `Claim “${state.readyPass.title}”?`,
          summary: `Readiness is ${readiness.completed} of ${readiness.total}. Claim the shareable achievement only if the verified unlock rule is satisfied.`,
          details: { readiness, readyPass: state.readyPass, purchaseMade: false },
          confirmLabel: "Claim Ready Pass",
        });
        return decision.approved ? store.claimReadyPass() : decision.result;
      },
    },
    {
      name: "undo_last_confirmed_action",
      description: "Undo the last reversible confirmed mutation and restore the previous visible OCHECK state after human confirmation.",
      inputSchema: objectSchema(),
      execute: async () => {
        const decision = await confirmOrCancel(confirmAction, {
          eyebrow: "Recovery · Human confirmation",
          title: "Undo the last confirmed change?",
          summary: "Restore the previous demo state and record the recovery in the audit trail.",
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
    onStatus?.({
      supported: false,
      registered: 0,
      message: "Open this page in ChatGPT’s built-in browser to activate Site Tools.",
    });
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
    message: failures.length
      ? `${registered} Site Tools active; ${failures.length} failed.`
      : `${registered} Site Tools active in this page.`,
  };
  onStatus?.(status);
  return status;
}

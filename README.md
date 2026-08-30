# OCHECK — Make the Experience Official

> WebMCP Challenge Edition · private development draft

Every experience already has an integrator. Today, it is usually the customer—forced to reconcile emails, chats, PDFs, maps, deadlines, providers, partner offers, and last-minute changes.

OCHECK changes who does that work. It becomes the **organizer-governed, official and sponsor-enabled integration layer**: one trusted experience where the organizer, an AI agent, a person, and authorized partners share the same outcome state. Unstructured inputs become sequenced, source-traceable action; verified completion then powers event virality and higher-intent sponsor signals.

**OCHECK is not another touchpoint. It is the official integration layer between all of them.**

## Challenge thesis

Most digital products add another touchpoint. Chats generate answers. Checklists store tasks. OCHECK integrates **every authorized touchpoint around one official, verifiable result—and turns verified customer value into growth**.

The hierarchy is deliberate:

- **Official experience first** — the customer stops acting as the accidental integrator; the organizer governs one route across rules, timing, services, personal AI support, verified progress, optional sponsored value, and reward.
- **Hook 01 · Event virality** — verified completion unlocks a shareable Ready Pass whose clean referral starts a new guide without transferring personal progress.
- **Hook 02 · Sponsor accuracy** — a real contextual need leads to a disclosed offer, a need-matched open, and an explicit opt-in. These signals support more accurate customer-intent understanding than impressions alone.

The synthetic demo does not claim demographic or predictive accuracy. It demonstrates a stronger, auditable signal basis: context plus confirmed action.

The Challenge Edition demonstrates one continuous cycle:

1. **Identify fragmentation** — ChatGPT reads the emails, chats, requirements, service proposals, and open ideas the customer would otherwise have to assemble.
2. **Integrate** — OCHECK converts those inputs, actors, services, sponsor value, and reward into one inspectable official experience.
3. **Govern** — OCHECK validates authority, outcome clarity, definition of done, phases, deadlines, evidence, sources, sponsorship disclosure, and reward logic.
4. **Publish** — Official truth changes only after explicit organizer confirmation.
5. **Personalize** — The agent creates a personal plan without rewriting the source.
6. **Verify** — Completion uses visible evidence, human confirmation, audit activity, and Undo.
7. **Create relevant value** — Sponsored actions remain optional and analytically separate from completion while explicit activations become high-intent signals.
8. **Reward and grow** — Completing every required preparation action unlocks an OCHECK Ready Pass and a clean, measurable event-referral path.

This is also a demonstration of how long or chaotic AI conversations can be anchored to a structured outcome state: result, definition of done, current phase, next best action, and remaining open loops.

## Founder story: access is part of the innovation

OCHECK was founded and is product-managed by **Gustavo García Figueroa, a 43-year-old Colombian lawyer—not a software engineer—with intermediate English and no traditional technical background**.

Using ChatGPT and Codex as working tools, and Vercel as deployment infrastructure, he translated domain judgment into product requirements, customer-experience decisions, governance rules, tests, and a functioning WebMCP application. Gustavo brought the idea, inventiveness, product judgment, and accountability. ChatGPT and Codex provided execution leverage by turning language into flows, code, tests, and rapid iteration.

> **“The human mind has always had limits. Until now.”**

Technology did not replace the human mind. It expanded what one determined person could build with it.

That makes the founder story relevant to the product thesis, not merely biographical. Millions of professionals understand important problems but cannot yet convert their knowledge into working software. Agentic tools can reduce the translation cost between lived expertise and globally useful products. OCHECK demonstrates this twice: through how it was built, and through a product that helps any person turn unstructured intent into a governed, verifiable outcome.

The project uses generally available OpenAI and Vercel products. It does not claim endorsement, a commercial relationship, or preferential support from any challenge sponsor.

## Three perspectives, one state

### Participant

A mobile-first OCHECK guide replaces the participant’s work of assembling a fragmented experience. One official source integrates rules, timing, AI assistance, verified progress, optional partner value, and a prize visible from the start. The participant can inspect sources, act, share through a clean referral, and reverse the last confirmed mutation.

### Organizer + AI

The AI Guide Forge accepts scattered operational inputs instead of forcing a rigid template. ChatGPT identifies touchpoints, sources, actors, services, and open loops through WebMCP, then integrates them into an organizer-governed official experience. It also designs both ethical growth hooks: share-worthy verified rewards and optional contextual sponsor value. The draft publishes only after validation and a separate human decision.

### Partner impact

A synthetic dashboard shows the value of official integration for customers, events, and partners while keeping official progress separate from commercial interaction. It reports readiness, impressions, need-matched opens, explicit benefit opt-ins, prize sharing, and clean referred starts. The agent returns the same model through `get_commercial_impact`. All figures are clearly labeled illustrative.

## What is new for the challenge

OCHECK had a pre-existing private MVP for building and completing official guides. This repository contains only new challenge work:

- browser-native WebMCP Site Tools;
- unstructured brief → AI-generated official guide;
- explicit outcome contracts and open-loop state;
- nested guide creation schemas beyond fixed templates;
- separate Organizer + AI, Participant, and Partner Impact perspectives;
- source traceability and completion evidence;
- contextual sponsored utility with strict optionality and explicit high-intent signals;
- result-based Ready Pass and clean prize-led virality loop;
- visible human confirmation, audit activity, and Undo;
- synthetic data and one-click reset;
- dependency-free runtime with no login or private production service.

It does not contain production code, real user data, private partner information, authentication, payment flows, or proprietary infrastructure.

## WebMCP Site Tools

The top-level page registers 13 narrow tools through document.modelContext.registerTool.

| Tool | Type | Purpose |
|---|---|---|
| get_outcome_state | Read | Inspect the official integrated experience, authority, result, phase, next action, open loops, progress, sponsored utility, and reward. |
| get_creation_brief | Read | Read the organizer’s scattered inputs, integration burden, and current draft. |
| validate_guide_draft | Read | Validate governance, evidence, sources, sponsorship, and reward logic. |
| get_participant_progress | Read | Inspect verified progress, readiness, remaining actions, and reward eligibility. |
| get_sponsor_opportunities | Read | Inspect optional, disclosed partner utility and its contextual signal basis without activating it. |
| get_commercial_impact | Read | Inspect official integration value, prize-led virality, sponsor accuracy signals, and referral metrics. |
| stage_ai_guide_draft | Confirm + write | Integrate scattered inputs into a proposed official experience without publishing. |
| publish_official_guide | Confirm + write | Publish a valid staged guide as a new official version. |
| create_personal_plan | Confirm + write | Create a contextual plan without changing official truth. |
| complete_guide_action | Confirm + write | Verify an action and update visible progress. |
| activate_sponsor_benefit | Confirm + write | Activate optional synthetic value without purchase or completion. |
| claim_readiness_reward | Confirm + write | Claim the Ready Pass only after the verified unlock rule is satisfied. |
| undo_last_confirmed_action | Confirm + write | Restore the previous reversible state. |

## Human-control model

- Read tools use readOnlyHint: true.
- Input schemas are narrow and reject additional properties.
- Organizer and participant authority is enforced in application state.
- An AI-generated proposal does not equal publication.
- Every write opens an in-page confirmation with exact proposed data.
- Results update the same visible state the person and agent inspect.
- Confirmed changes create audit activity.
- The last mutation can be undone.
- Sponsored interaction never makes a purchase, shares personal progress, or completes an official requirement.
- Sponsor “accuracy” is grounded in contextual opens and explicit opt-ins; no unsupported predictive-accuracy claim is made.
- A prize can be claimed only after its verified unlock rule becomes true, and its referral starts a clean guide.

The built-in browser applies its own Site Tools safety review. OCHECK’s confirmation layer is an additional product control.

## Run locally

Requirements: Node.js 20 or newer.

~~~bash
npm run dev
~~~

Open http://127.0.0.1:4173.

Run the dependency-free suite:

~~~bash
npm test
npm run check
~~~

The regular interface works in any modern browser. To discover and invoke Site Tools, open the deployed page in ChatGPT’s built-in browser with Site Tools enabled.

## Architecture

~~~text
Emails + chats + PDFs + maps + services + partner proposals
                           ↓
               ChatGPT + WebMCP Guide Forge
                           ↓
               staged + validated integration
                           ↓
                  human confirmation
                           ↓
        Organizer-governed Official Experience State
                           ↓
       Participant journey + Sponsor Hook + Prize Hook
~~~

The edition intentionally has no runtime dependencies or backend:

~~~text
index.html + styles.css
        ↓
      app.js
        ↓
 GuideStore ←→ visible interface
        ↑
  WebMCP Site Tools
~~~

## Data and privacy

All events, participants, organizations, partners, figures, reward codes, and activity are synthetic. State exists only in the current page and resets on reload or through **Reset demo**.

## Status and license

The repository remains private while the challenge edition and intellectual-property boundary are validated. No open-source license has been selected yet. Public visibility and an approved license will be added before submission only after explicit authorization.

## References

- [OpenAI Site Tools documentation](https://learn.chatgpt.com/docs/webmcp)
- [WebMCP proposed specification](https://webmachinelearning.github.io/webmcp/)

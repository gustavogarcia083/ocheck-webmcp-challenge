# OCHECK — Agent-Ready Official Guides

> WebMCP Challenge Edition · private development draft

OCHECK turns official information into personalized, verifiable action. This standalone challenge edition demonstrates how a website, an AI agent, and a person can share the same live guide while protecting official truth and keeping consequential actions under human control.

## Challenge thesis

Most digital products organize information. OCHECK organizes intention: a trusted outcome, the official steps required to reach it, a personal assistance layer, and verified progress.

The demo separates three layers:

1. **Official Truth** — organizer-approved, versioned guidance.
2. **Personal Assist** — contextual prioritization that never rewrites the source.
3. **Verified Progress** — confirmed, visible, auditable, reversible actions.

It also demonstrates clearly disclosed, optional sponsored actions where a partner creates value by helping the participant complete a real step instead of interrupting attention.

## What is new for the challenge

OCHECK had a pre-existing private MVP for building and completing official guides. This repository contains only new challenge work:

- a dependency-free standalone web application;
- fully synthetic event and partner data;
- browser-native WebMCP registration;
- separate Participant and Organizer modes;
- narrow read and write tools;
- explicit human confirmation inside the page;
- guide validation, versioning, audit activity, and Undo;
- a one-click reset for repeatable judging.

It does not contain production code, real user data, private partner information, authentication, payment flows, or proprietary infrastructure.

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm run dev
```

Open `http://127.0.0.1:4173`.

Run the dependency-free test suite:

```bash
npm test
npm run check
```

The regular interface works in any modern browser. To discover and invoke the registered Site Tools, open the deployed page in ChatGPT’s built-in browser with Site Tools enabled.

## Site Tools

The top-level page registers tools through `document.modelContext.registerTool`.

| Tool | Type | Purpose |
|---|---|---|
| `get_guide_state` | Read | Inspect the shared guide, role, progress, plan, proposals, and audit state. |
| `find_official_actions` | Read | Search official actions by phase, text, or requirement. |
| `get_participant_progress` | Read | Inspect verified progress and remaining required actions. |
| `get_sponsor_actions` | Read | Inspect optional, clearly disclosed partner value. |
| `validate_official_guide` | Read | Check deadlines, disclosures, identifiers, content, and phase coverage. |
| `create_personal_plan` | Confirm + write | Build a personal plan without changing official truth. |
| `complete_guide_action` | Confirm + write | Complete an action and update visible progress. |
| `select_sponsor_action` | Confirm + write | Save optional partner interest without purchasing or navigating away. |
| `propose_official_action` | Confirm + write | Queue an organizer change without publishing it. |
| `publish_approved_changes` | Confirm + write | Publish reviewed changes into a new official version. |
| `undo_last_confirmed_action` | Confirm + write | Restore the previous reversible demo state. |

## Human-control model

- Read tools have `readOnlyHint: true`.
- Input schemas are narrow and reject additional properties.
- Participant and Organizer permissions are separated.
- A proposal does not equal publication.
- Every write tool opens an in-page confirmation with the exact proposed data.
- Results update the same visible state the person sees.
- Confirmed changes create audit activity.
- The last mutation can be undone.
- Sponsored actions are synthetic, optional, disclosed, and never make a purchase.

The built-in browser also applies its own Site Tools safety review. The in-page confirmation is an additional product-level control.

## Architecture

This edition intentionally has no runtime dependencies and no backend:

```text
index.html + styles.css
        ↓
      app.js
        ↓
 GuideStore ←→ visible interface
        ↑
  WebMCP Site Tools
```

The absence of authentication, external data, and hidden services makes the judging experience deterministic and keeps the challenge repository separate from OCHECK’s production product.

## Data and privacy

All names, organizations, events, users, partners, dates, and activity in this demo are synthetic. State exists only in the current browser page and resets on reload or through **Reset demo**.

## Status and license

This repository remains private while the challenge edition and intellectual-property boundary are validated. No open-source license has been selected yet. Public visibility and an approved license will be added before submission only after explicit authorization.

## References

- [OpenAI Site Tools documentation](https://learn.chatgpt.com/docs/webmcp)
- [WebMCP proposed specification](https://webmachinelearning.github.io/webmcp/)

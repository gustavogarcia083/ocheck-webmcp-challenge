# WebMCP Challenge provenance

This document distinguishes OCHECK work that existed before the WebMCP
Challenge from the self-contained implementation created during the official
submission period.

## Entrant and project

- **Entrant:** Gustavo García Figueroa
- **Project:** OCHECK — Make the Experience Official
- **Repository:** `gustavogarcia083/ocheck-webmcp-challenge`
- **Live challenge build:** https://ocheck-webmcp-challenge.vercel.app/
- **Challenge period:** August 25, 2026 at 11:00 a.m. PT through September 3,
  2026 at 1:00 p.m. PT

## Work that existed before the challenge

Before August 25, 2026, OCHECK already existed as a product concept, brand,
business model, and private MVP for creating and completing official guides.
That earlier work established the underlying problem: participants were forced
to assemble fragmented event information, while organizers lacked one governed
experience layer.

The private product, production repositories, real customer or partner data,
authentication, billing, payment flows, private infrastructure, and other
proprietary materials are not part of this submission.

## Work created during the challenge

The code in the Challenge Edition was created after the submission period
opened. It is a standalone, dependency-free implementation that runs with
synthetic data and does not require access to the private MVP.

Challenge-period additions include:

- 13 browser-native WebMCP Site Tools;
- six narrow read tools and seven human-confirmed write tools;
- an unstructured organizer brief transformed into a staged official guide;
- separate staging, validation, and publication states;
- organizer, participant, and partner-impact perspectives sharing one state;
- source traceability, completion evidence, audit activity, and Undo;
- personal planning without modification of official truth;
- optional sponsored utility separated from official completion;
- verified Ready Pass eligibility, claiming, and clean referral behavior;
- synthetic, non-identifying impact metrics and one-click reset; and
- an automated test suite covering the end-to-end human-agent experience.

## Timestamped implementation evidence

All implementation commits are dated inside the challenge period.

| UTC date | Commit | Purpose |
|---|---|---|
| 2026-08-30 02:39 | [`222222d`](https://github.com/gustavogarcia083/ocheck-webmcp-challenge/commit/222222d6cd0c47a36e10a667a6b9a8c2377ac7e4) | Build private WebMCP Challenge Edition |
| 2026-08-30 12:13 | [`eb735db`](https://github.com/gustavogarcia083/ocheck-webmcp-challenge/commit/eb735db471c23a7f88998cf23643c327e93486b4) | Reframe around outcomes, AI creation, and accessible innovation |
| 2026-08-30 13:36 | [`2759ec4`](https://github.com/gustavogarcia083/ocheck-webmcp-challenge/commit/2759ec4e005d31bb4104265e4ff64399130d4355) | Make customer experience and dual growth hooks central |
| 2026-08-30 14:14 | [`18d11e1`](https://github.com/gustavogarcia083/ocheck-webmcp-challenge/commit/18d11e1291bc8855f93223ce7b7e812fb5f12d58) | Make OCHECK the official experience integrator |
| 2026-08-30 17:47 | [`9c05c7e`](https://github.com/gustavogarcia083/ocheck-webmcp-challenge/commit/9c05c7e1e096665ec510198ac0f45c018e8ae395) | Reframe Ready Pass as verified achievement |
| 2026-08-30 20:21 | [`cc3487c`](https://github.com/gustavogarcia083/ocheck-webmcp-challenge/commit/cc3487ce0d50e3391a61afaa9902c7daa86d8df3) | Make Ready Pass the satisfaction hook |
| 2026-08-30 20:32 | [`8ebf115`](https://github.com/gustavogarcia083/ocheck-webmcp-challenge/commit/8ebf115582b81ce9a8b66066aa2c77e7a23394e2) | Separate Ready Pass from sponsor value |

## Reproduce and verify

Requirements: Node.js 20 or newer. The project has no runtime or package
dependencies.

```bash
npm test
npm run check
npm run dev
```

Then open `http://127.0.0.1:4173`. Site Tools can be discovered and invoked in
ChatGPT's in-app browser or another WebMCP-capable browser.

## AI-assisted development and ownership

Gustavo García Figueroa originated the product concept and directed its product
logic, user experience, governance, privacy boundaries, commercial model, and
testing decisions. ChatGPT and Codex were used as generally available working
tools to translate those decisions into flows, source code, tests, and rapid
iteration.

The project does not claim endorsement, investment, a commercial relationship,
or preferential support from OpenAI, Vercel, or another challenge sponsor. It
uses no third-party runtime SDK, private API, production dataset, or unlicensed
media asset.

## License and brand boundary

The Challenge Edition source code is licensed under the BSD 3-Clause License.
The OCHECK name and brand identity are governed separately; see
[`TRADEMARKS.md`](TRADEMARKS.md).

The official challenge rules remain the authoritative source for submission
requirements: https://webmcp.devpost.com/rules

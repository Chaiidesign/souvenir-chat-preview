# Experience Laboratory 001 — Merchant diagnosis

## What is implemented
Route: `/experience-lab`. The current `/chat-preview` remains unchanged.
Three views of one frozen, illustrative revenue diagnosis:
- Conversational answer, with evidence on demand.
- Structured answer, with metric cards and evidence table.
- Composed answer, with a comparison graphic and progressive disclosure.

A compact/comfortable density switch and local 1–5 usefulness rating enable initial design reviews. Ratings are not stored or transmitted. No real store data or agent actions are connected. Any apparent causes are labeled as hypotheses.

## Source inventory: adopt, adapt, reference, reject

| Source | Candidate surfaces | Decision | Why |
|---|---|---|---|
| Flowting frontend `src/lib/markdown-utils.tsx` | text, citations, math, tables | Adopt when integrating | Existing customized, token-based renderer; avoid duplicate |
| Souvenir DS / Kaya | buttons, menus, tokens, typography, accessibility | Adopt when integrating | Existing design authority; this isolated page uses temporary styles |
| Original Chat Preview | response timing, tool activity, rich tables/charts, errors | Adapt | Useful explorations, not validated merchant experiences |
| Shopify Polaris | index tables, filters, data actions, merchant conventions | Reference | Patterns fit commerce; visual components are not Kaya |
| Slack Block Kit | declared blocks, message/action composition | Reference | Learn constrained blocks; do not embed Slack-rendered UI |
| Vercel AI Elements | streaming, tool states, message primitives | Evaluate | Compare against existing chat code; adopt only missing functionality |
| assistant-ui | chat runtime, composer, streaming, threads | Evaluate | Overlaps production chat runtime |
| json-render | typed component catalogs, constrained rendering | Spike separately | Relevant for generative composition, not needed for baseline |
| A2UI | portable declarative agent UI | Monitor/evaluate | Avoid protocol commitments in week-one prototype |
| CopilotKit | agent UI runtime and actions | Evaluate | Not necessary for static comparison |
| Recharts (production) | chart primitives | Adopt when integrating | Already present, no second chart library |
| Tremor | analytical display recipes | Reference | Avoid second DS |
| Tiptap/MDX | rich editing | Defer | Not required for a read-only Markdown document surface |

Source entrypoints:
- https://github.com/Flowting-ai/front-end
- https://github.com/Chaiidesign/souvenir-ds
- https://github.com/vercel/ai-elements
- https://github.com/assistant-ui/assistant-ui
- https://github.com/vercel-labs/json-render
- https://github.com/a2ui-project/a2ui
- https://github.com/CopilotKit/CopilotKit
- https://shopify.dev/docs/api/app-home/latest/web-components
- https://docs.slack.dev/block-kit/

These are integration candidates and design references, **not vetted package imports**. Verify versions, licenses, maintainership, security, and compatibility before adopting anything.

## Evaluation protocol

Use the same underlying figures and source for all views. Ask reviewers to:
1. State the exact revenue change and comparison period.
2. Identify what the evidence proves and what remains unverified.
3. Find the next investigation step.
4. Rate clarity and perceived effort.
5. Record completion time and errors separately from visual preference.

Test with merchants, not only internal designers. Counterbalance presentation order to reduce primacy effects. Treat small pilots as qualitative, not proof of superiority.

## Production integration boundaries

- The existing `front-end` owns production conversation and Markdown rendering.
- Souvenir DS/Kaya owns visual tokens and component governance.
- AG-OUT owns evidence, authority, and OutputDecision; the gallery does not simulate real authorization.
- Output Lab owns deeper evaluation and learning.
- Never run arbitrary model-generated MDX/React/HTML or let visual blocks invent authorized actions.
- Preserve provenance, uncertainty, source currency, and trusted operations across renderers.
- Keep this lab isolated until technical and human reviews pass.

## Next implementation steps
1. Port the chosen view to Kaya components rather than copying page CSS.
2. Replace hardcoded facts with a typed, validated scenario fixture.
3. Compare with the production Markdown renderer; reuse it where possible.
4. Add accessibility and responsiveness checks and UI screenshot tests.
5. Run merchant usability sessions and document concrete failures.
6. Only then spike a constrained catalog renderer like json-render.

## Known limitations
No build/test execution in this connector session. The standalone view needs a normal `npm install && npm run build` and browser review before merge. No deployment has been created. The first page intentionally has no dependency additions.

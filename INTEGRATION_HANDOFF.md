# Standalone chat prototype → Souvenir output preview

Updated October 13, 2026. This repository remains a standalone design and animation reference. The canonical product and combined internal preview belong in [Flowting-ai/front-end](https://github.com/Flowting-ai/front-end), branch [`feat/output-experience`](https://github.com/Flowting-ai/front-end/tree/feat/output-experience). Read its [published Claude Code handoff](https://github.com/Flowting-ai/front-end/blob/docs/claude-output-handoff/research/output-ecosystem/CLAUDE_CODE_HANDOFF.md) before integrating. The full preview implementation is still local pending approval for public publication.

## What is here

The source at `app/chat-preview/page.tsx` contains synthetic scenarios S1–S17 and E1–E2, despite the older README listing only four demo modes. The scenarios cover simple answers, reasoning, web research, attachments, pins, connectors, structured outputs, mixed content and errors. This page also holds the activity/research panel, citations/source cards, tables/charts/steps/callouts, motion, debug controls and timer-driven replay in one large file. Pin integration review to `d5109dd0f66ac8166d33d87b0c43b596fc9d316c`.

## Integration decision

Extract the demo cases and expected event sequences as typed fixtures into the full frontend's Journey gallery. Evaluate reusable component and motion patterns one at a time against the current Souvenir implementation. The full frontend keeps one assistant-ui/Souvenir-owned chat state and one approved generative UI renderer; do not install this page as a competing runtime. Remove the standalone model picker, cycling model branding, timing sliders and other prototype controls from the operator view. Keep configuration in a developer panel. Show a source/tool event in live mode only if it actually happened; synthetic replay must be labeled. No arbitrary model-supplied executable UI.

The combined preview is an internal review artifact using synthetic merchant evidence. Host it as a separate access-protected preview after verification, not as a production release. Do not copy a local OpenRouter key into either repository or the browser. The standalone repository has no observed license file, so record source ownership, permission, paths and changes before copying its code into the product repository; do not assume the source is MIT.

## Source map

- Fixture types and `SCENARIOS`: beginning of `app/chat-preview/page.tsx`, especially S1–S17/E1–E2.
- Research/activity/citations: `ReasoningStepRow`, `ActivityRow`, `ResearchBlock`, `SourceList`, `SourceCard`, `CitationChip`.
- Structured response examples: `AnimatedTable`, `AnimatedBarChart`, `AnimatedSteps`, `AnimatedCodeBlock`, `AnimatedCallout`, `AnimatedTags`, `AnimatedPieChart`, `AnimatedLineChart`, `AnimatedCard`.
- Error and follow-up examples: `AnimatedConnectorError`, `AnimatedSearchTimeout`, `FollowUpRouter`.
- Prototype-only orchestration: `ChatPreview` and its phase delays, replay timers, model options and controls. Extract fixture semantics; do not reuse those timers as evidence of real work.

Keep this repository readable as the original reference. Publish the combined implementation, verification and handoff in the full frontend branch.

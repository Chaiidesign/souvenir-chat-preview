# Souvenir — Chat Preview

**Live preview → [chat-preview-standalone.vercel.app/chat-preview](https://chat-preview-standalone.vercel.app/chat-preview)**

Animation prototype for the Souvenir V2 individual chat experience. Shows how the message flow looks and feels before engineering builds it.

For the current integration into the full Souvenir frontend, read [INTEGRATION_HANDOFF.md](INTEGRATION_HANDOFF.md). This standalone prototype is a reference; the combined output experience belongs in `Flowting-ai/front-end` on `feat/output-experience`.

---

## What this shows

The original four core modes are below. The current source also includes synthetic scenarios S1–S17 and E1–E2, with files, connectors, structured output and mixed content. See the integration handoff for the source map and reuse boundaries.

| Mode | What happens |
|------|-------------|
| **Simple** | Routing → model chosen → text streams in → done |
| **Research** | Same, plus web sources load one by one → collapse → stream |
| **E1 Error** | Connector auth failure — inline in the response |
| **E2 Error** | Web search timeout — partial sources, then inline error |

## Running locally

```bash
npm install
npm run dev
```

Open [localhost:3000/chat-preview](http://localhost:3000/chat-preview)

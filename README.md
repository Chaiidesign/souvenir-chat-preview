# Souvenir — Chat Preview

**Live preview → [chat-preview-standalone.vercel.app/chat-preview](https://chat-preview-standalone.vercel.app/chat-preview)**

Animation prototype for the Souvenir V2 individual chat experience. Shows how the message flow looks and feels before engineering builds it.

---

## What this shows

Four demo modes at the top of the page:

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

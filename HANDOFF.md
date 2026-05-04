# Molly — Session Handoff

## What this project is

**Molly** is a Claude-powered Q&A web app built as a 6-week incremental project.
Each week adds a layer of complexity on top of the working foundation.
This handoff covers Weeks 1–3 scope (all features implemented so far).

**Repo:** `bralash/build-with-claude`
**Working directory:** `/Users/lashsmac/Desktop/workspace/claude-labs`

---

## Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js (tsx, no compile step) |
| Backend | Express 5 + `@anthropic-ai/sdk` |
| Frontend | Vanilla HTML / CSS / JS (no framework) |
| Markdown | `marked.js` via CDN |
| Fonts | DM Serif Display (brand) + Outfit (body) + JetBrains Mono (code) — Google Fonts |

---

## File structure

```
claude-labs/
├── src/
│   └── server.ts          # Express server + /api/ask + /api/ask-stream endpoints
├── public/
│   ├── index.html         # App shell (three-column layout)
│   ├── style.css          # All styles (CSS custom properties for theming)
│   └── app.js             # All client logic (conversation store, streaming, info panel)
├── .env                   # ANTHROPIC_API_KEY + PORT (gitignored)
├── .env.example
├── README.md
├── REFLECTION.md
└── HANDOFF.md             # ← this file
```

---

## How to run

```bash
npm install
cp .env.example .env      # add your ANTHROPIC_API_KEY
npm run dev               # tsx watch src/server.ts → http://localhost:3000
```

The server logs `API key loaded: sk-ant-api...XXXX` on startup to confirm
dotenv loaded correctly. If you see `ERROR: ANTHROPIC_API_KEY is not set`,
the `.env` file is missing or the key is blank.

**dotenv quirk:** The Claude Code shell hook pre-sets `ANTHROPIC_API_KEY` to
an empty string before spawning processes, which causes the default
`import "dotenv/config"` to silently skip loading the real key. The server
uses `dotenv.config({ override: true })` to work around this.

---

## Architecture: backend (`src/server.ts`)

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/ask` | Batch (wait for full response) |
| `POST` | `/api/ask-stream` | Streaming via Server-Sent Events |

### Request body (both endpoints)

```json
{
  "messages": [{ "role": "user", "content": "..." }, ...],
  "persona": "casual",
  "model": "claude-sonnet-4-6"
}
```

A backward-compatible `question` string is also accepted (single-turn fallback),
handled by `resolveMessages()`. If `messages` is present and non-empty, it is used;
otherwise `question` is wrapped into a single-message array.

### Response shape

**Batch (`/api/ask`):**
```json
{
  "answer": "...",
  "stop_reason": "end_turn",
  "model": "claude-sonnet-4-6",
  "usage": { "input_tokens": 42, "output_tokens": 108 }
}
```

**Streaming (`/api/ask-stream`):**
SSE stream; each event is a JSON line prefixed with `data: `.

| Event type | Shape |
|---|---|
| `delta` | `{ type: "delta", text: "..." }` — one token chunk |
| `done` | `{ type: "done", stop_reason, model, usage: { input_tokens, output_tokens } }` |
| `error` | `{ type: "error", message: "..." }` |

### Personas (personality-based)

| Key | Voice |
|---|---|
| `casual` | Relaxed, friend-like, no jargon |
| `playful` | Upbeat, witty, entertaining |
| `professional` | Formal, precise, boardroom-ready |
| `creative` | Imaginative, vivid, unconventional angles |
| `mentor` | Patient, builds understanding, explains the why |

### Models (allowlist)

- `claude-haiku-4-5` — Fast
- `claude-sonnet-4-6` — Balanced (default)
- `claude-opus-4-5` — Most capable

---

## Architecture: frontend

### Layout (three-column)

```
┌──────────────┬───────────────────────────────────┬─────────────┐
│   Sidebar    │             Main                   │ Info panel  │
│   240 px     │           flex: 1                  │   210 px    │
│              │  ┌─────────────────────────────┐  │             │
│ Conversation │  │ Topbar (persona badge + ⚙)  │  │ Messages    │
│ list         │  ├─────────────────────────────┤  │ Tokens      │
│              │  │ Chat thread                 │  │ Model       │
│ [+ new chat] │  │ (message-pair, max 720px)   │  │ Persona     │
│              │  ├─────────────────────────────┤  │ Memory      │
│              │  │ Input bar + model chips     │  │             │
└──────────────┴───────────────────────────────────┴─────────────┘
```

### Conversation sidebar

- Lists all saved conversations (title = first 45 chars of first user message)
- Pencil icon (✎) in sidebar header starts a new chat
- Clicking a conversation restores the full message thread from localStorage
- Active conversation is highlighted
- Maximum 50 conversations stored (oldest discarded when limit is reached)

### Chat thread

- User messages: right-aligned pastel bubble
- Assistant messages: left-aligned card with background, border, and subtle shadow
- Message pairs grouped in `.message-pair` (max-width 720px, centered)
- Animated thinking dots while the API call is in-flight
- `Enter` sends; `Shift+Enter` inserts a new line
- Textarea auto-grows with content

### Info panel (right side)

Always visible; updates after every API response:

| Field | Description |
|---|---|
| Messages | Total turn count in the current conversation |
| Tokens — Input | Cumulative input tokens this conversation |
| Tokens — Output | Cumulative output tokens this conversation |
| Tokens — Total | Combined total |
| Last turn | Input / output tokens for the most recent exchange |
| Model | Model name used for the last response |
| Persona | Active persona key |
| Memory | ON/OFF badge showing conversation memory state |

Token totals reset when switching to a different conversation or starting a new chat.

### Settings panel

- Gear icon in the topbar opens a slide-in right drawer
- **Persona** — 5 text-only cards; selecting one changes the voice AND accent colour
- **Appearance** — Light / Dark mode toggle
- **Conversation memory** — Toggle; when ON, full message history is sent to the API each turn
- **Streaming** — Toggle; when ON, tokens appear word-by-word as Claude generates them
- Escape or clicking the overlay closes the panel

### Model selector

Three pill chips below the input: Haiku · Sonnet · Opus.
Selected chip highlighted in the current accent colour.

### Streaming

- **Off (default):** `POST /api/ask` — waits for full response, then renders markdown.
- **On:** `POST /api/ask-stream` — SSE endpoint. Client reads `ReadableStream`,
  appends each `delta` token as a `<span class="chunk-token">` (fade-in animation),
  replaces the raw spans with a single `marked.parse()` render on the `done` event.
  A blinking cursor `▍` is shown during generation.

### Conversation memory

- **Off (default):** Each request sends only the current message (stateless).
- **On:** Full conversation history (`messages[]`) is passed to the API on every turn,
  giving Claude context of the entire thread.

### Theming system (CSS custom properties)

- `data-theme` on `<html>`: `light` (default) | `dark`
- `data-accent` on `<html>`: set automatically when a persona is selected

| Persona | Accent key | Hex |
|---|---|---|
| Casual | `cream` | `#F5EBE0` |
| Playful | `coral` | `#FEC5BB` |
| Professional | `taupe` | `#DED6CE` |
| Creative | `pink` | `#FAE1DD` |
| Mentor | `sage` | `#D8E2DC` |

- Dark mode uses warm brown tones (`#18130F` base), not cold grays.
- All dark mode text verified for WCAG AA contrast.

### LocalStorage keys

| Key | Value |
|---|---|
| `molly-persona` | Active persona key |
| `molly-model` | Selected model id |
| `molly-theme` | `"light"` \| `"dark"` |
| `molly-streaming` | `"true"` \| `"false"` |
| `molly-conversation` | `"true"` \| `"false"` (memory toggle state) |
| `molly-conversations` | JSON array of conversation objects |
| `molly-active-conv` | ID string of the currently selected conversation |

Accent colour is NOT stored — always derived from the active persona on load.

---

## Git state

**Active branch:** `feat/conversation-sidebar`
**Base:** `master`

Uncommitted changes exist in `public/app.js`, `public/index.html`,
`public/style.css`, and `src/server.ts` (the four items from the most
recent feature set: removed footnote, nicer chat area, info panel, this HANDOFF update).

### Commit history (newest first)

```
554b447  Add conversation sidebar with persistent history
d397f94  Add conversation memory with toggle
1863d32  Add fade-in animation to streamed text chunks
5571f89  Smooth streaming: append text incrementally, render markdown on completion
fd58510  Add streaming responses — activate toggle, wire SSE endpoint
212d22f  Merge pull request #5 from bralash/feat/settings-and-model-selector
8f23d53  Untrack HANDOFF.md and add to .gitignore
6dac5ed  Fix avatar initial from D to M
b09d558  Rename application from DevQ to Molly
9605e24  Replace job-role personas with personality types
a7fa263  Fix dark mode accessibility (WCAG AA)
2580a3c  Redesign UI with Embroidery pastel palette
043e6c4  Add settings panel, model selector, streaming toggle
af90497  Redesign UI as persistent chat interface
132c631  Add persona switcher
5dae814  Separate frontend into CSS/JS files + markdown rendering
d0d9b6d  Week 1 - Basic Q&A App
```

---

## What's coming (future weeks)

- **Prompt caching** — add Anthropic prompt caching headers to reduce latency
  and cost on repeated system prompts (system prompt is identical every turn — prime
  candidate for caching).
- **Tool use** — give Claude the ability to call functions (e.g. web search,
  calculator) and surface results inline in the chat.
- **File uploads** — allow users to attach documents or images to a message.
- **Usage dashboard** — persist token counts across sessions and show a running total.

---

## Known quirks

1. **`dotenv.config({ override: true })`** — see dotenv section above.
2. **Token counts reset on conversation switch** — `convTokens` is in-memory only.
   Cumulative per-conversation token totals are not persisted to localStorage.
3. **Info panel is always visible** — there is no toggle to hide it. On narrow
   screens the three-column layout may squeeze the main area.
4. **Streaming re-renders markdown once on `done`** — the fade-in spans are replaced
   by parsed HTML at end of stream. Code blocks and tables will not appear
   incrementally; they render all at once when Claude finishes.
5. **Max 50 conversations** — oldest conversation is silently dropped when the
   limit is reached.
6. **tsx watch** — the server restarts automatically on changes to `server.ts`,
   but browser must be refreshed manually after frontend changes.

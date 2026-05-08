# Molly — Session Handoff

## What this project is

**Molly** is a Claude-powered Q&A web app built as a 6-week incremental project.
Each week adds a layer of complexity on top of the working foundation.
This handoff covers the full feature set built so far (Weeks 1–3 scope).

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
| `POST` | `/api/ask` | Batch — waits for full response, returns JSON |
| `POST` | `/api/ask-stream` | Streaming — Server-Sent Events (SSE) |

### Request body (both endpoints)

```json
{
  "messages": [{ "role": "user", "content": "..." }, ...],
  "persona": "casual",
  "model": "claude-sonnet-4-6"
}
```

`resolveMessages()` provides backward-compatible handling: if `messages` is present
and non-empty it is used as-is; otherwise `question` (plain string) is wrapped into
a single-message array.

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

**Streaming (`/api/ask-stream`)** — SSE, each line prefixed `data: `:

| Event type | Shape |
|---|---|
| `delta` | `{ type: "delta", text: "..." }` — one token chunk |
| `done` | `{ type: "done", stop_reason, model, usage: { input_tokens, output_tokens } }` |
| `error` | `{ type: "error", message: "..." }` |

### Personas

| Key | Voice |
|---|---|
| `casual` | Relaxed, friend-like, no jargon (default) |
| `playful` | Upbeat, witty, entertaining |
| `professional` | Formal, precise, boardroom-ready |
| `creative` | Imaginative, vivid, unconventional angles |
| `mentor` | Patient, builds understanding, explains the why |

### Models (allowlist)

| ID | Label | Default |
|---|---|---|
| `claude-haiku-4-5` | Haiku — Fast | |
| `claude-sonnet-4-6` | Sonnet — Balanced | ✓ |
| `claude-opus-4-5` | Opus — Most capable | |

---

## Architecture: frontend

### Layout (three-column)

```
┌──────────────┬───────────────────────────────────┬─────────────┐
│   Sidebar    │             Main                  │ Info panel  │
│   240 px     │           flex: 1                 │   210 px    │
│              │  ┌────────────────────────────┐  │             │
│ Conversation │  │ Topbar (persona badge + ⚙) │  │ Messages    │
│ list         │  ├────────────────────────────┤  │ Tokens used │
│              │  │ Chat thread                │  │ Last turn   │
│ [✎ new chat] │  │ (message-pair, max 720px)  │  │ Model       │
│              │  ├────────────────────────────┤  │ Persona     │
│              │  │ Input bar + model chips    │  │ Memory      │
└──────────────┴───────────────────────────────────┴─────────────┘
```

### Conversation sidebar

- Lists all saved conversations ordered newest-first
- Title = first 45 characters of the first user message
- Pencil icon (✎) in the sidebar header starts a new chat
- Clicking a conversation restores the full message thread from localStorage and
  loads its persisted token totals into the info panel
- Trash icon appears on hover / active item — clicking it deletes that conversation;
  the UI automatically switches to the next available conversation (or blank state)
- Maximum 50 conversations; oldest is silently dropped when the limit is reached

### Chat thread

- User messages: right-aligned pastel bubble
- Assistant messages: left-aligned elevated card (background, border, shadow)
- Message pairs grouped in `.message-pair` (max-width 720px, centered)
- Animated thinking dots while the API call is in-flight
- `Enter` sends; `Shift+Enter` inserts a new line
- Textarea auto-grows with content

### Info panel (right side, always visible)

Updates after every API response and on conversation switch:

| Field | Description |
|---|---|
| Messages | Total turn count in the current conversation |
| Tokens — Input | Cumulative input tokens this conversation |
| Tokens — Output | Cumulative output tokens this conversation |
| Tokens — Total | Combined total |
| Last turn | Input / output tokens for the most recent exchange |
| Model | Model name used for the last response |
| Persona | Active persona key |
| Memory | ON / OFF badge showing conversation memory state |

Token totals are **persisted per conversation** inside each conversation object in
`localStorage`. Switching conversations restores the correct totals. Starting a new
chat resets the counters to zero.

### Settings panel

Opened via the gear icon (⚙) in the topbar. Slides in from the right, covering the
full chat area (sidebar edge to right edge of the window). Layout is a two-column grid:

| Row | Left column | Right column |
|---|---|---|
| 1 | **Persona** (spans both columns — 5 cards in a 3-col grid) | — |
| 2 | **Appearance** (spans both columns — Light / Dark mode) | — |
| 3 | **Conversation memory** toggle | **Streaming** toggle |

Escape or clicking the backdrop overlay closes the panel.

### Model selector

Three pill chips below the input: **Haiku** · **Sonnet** · **Opus**.
Selected chip highlighted in the current accent colour.

### Streaming

- **Off (default):** `POST /api/ask` — full response rendered in one pass via `marked.parse()`.
- **On:** `POST /api/ask-stream` — SSE stream. Each `delta` chunk is appended as a
  `<span class="chunk-token">` with a CSS fade-in animation. On the `done` event the
  raw spans are replaced with a single `marked.parse()` render. A blinking `▍` cursor
  is shown during generation.

### Conversation memory

- **Off (default):** Each request sends only the current message — stateless single-turn.
- **On:** The full `messages[]` array for the active conversation is sent to the API on
  every turn, giving Claude context of the entire thread.

### Theming system (CSS custom properties)

- `data-theme` on `<html>`: `"light"` (default) | `"dark"`
- `data-accent` on `<html>`: set automatically when a persona is selected

| Persona | Accent key | Hex |
|---|---|---|
| Casual | `cream` | `#F5EBE0` |
| Playful | `coral` | `#FEC5BB` |
| Professional | `taupe` | `#DED6CE` |
| Creative | `pink` | `#FAE1DD` |
| Mentor | `sage` | `#D8E2DC` |

Dark mode uses warm brown tones (`#18130F` base), not cold grays.
All dark mode text verified for WCAG AA contrast.

### LocalStorage keys

| Key | Value |
|---|---|
| `molly-persona` | Active persona key |
| `molly-model` | Selected model id |
| `molly-theme` | `"light"` \| `"dark"` |
| `molly-streaming` | `"true"` \| `"false"` |
| `molly-conversation` | `"true"` \| `"false"` (memory toggle state) |
| `molly-conversations` | JSON array of conversation objects (see shape below) |
| `molly-active-conv` | ID string of the currently selected conversation |

**Conversation object shape:**
```json
{
  "id": "conv_1234567890",
  "title": "First 45 chars of first message…",
  "messages": [
    { "role": "user",      "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "tokens": { "input": 312, "output": 540 },
  "updatedAt": 1234567890123
}
```

Accent colour is NOT stored — always derived from the active persona on load.

---

## Git state

**Active branch:** `feat/conversation-sidebar`
**Base branch:** `master`
**Remote:** `github.com:bralash/build-with-claude`
**Open PR:** #9 — "Week 3: Conversation sidebar with persistent history" (targets `master`)

All changes are committed and pushed. Working tree is clean.

### Commit history (newest first)

```
aaec3fb  Fix settings panel grid layout: Appearance full-width, Memory + Streaming side by side
841c081  Widen settings panel to full chat area with two-column layout
4f3f5ce  Persist token counts per conversation and add delete conversation
1ee2459  Polish chat UI: remove footnote, style messages, add token info panel, update HANDOFF
554b447  Add conversation sidebar with persistent history
d397f94  Add conversation memory with toggle
1863d32  Add fade-in animation to streamed text chunks
5571f89  Smooth streaming: append text incrementally, render markdown on completion
fd58510  Add streaming responses — activate toggle, wire SSE endpoint
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

- **Prompt caching** — add Anthropic prompt caching headers to reduce latency and cost.
  The system prompt is identical on every turn — prime candidate for caching.
- **Tool use** — give Claude the ability to call functions (e.g. web search, calculator)
  and surface results inline in the chat.
- **File uploads** — allow users to attach documents or images to a message.
- **Usage dashboard** — persist token totals across sessions and show a cumulative spend view.

---

## Known quirks

1. **`dotenv.config({ override: true })`** — Claude Code pre-sets `ANTHROPIC_API_KEY`
   to an empty string; `override: true` ensures the `.env` value wins.
2. **Info panel always visible** — no toggle to hide it. On narrow screens the
   three-column layout may squeeze the main area.
3. **Streaming renders markdown once on `done`** — code blocks and tables appear all
   at once at end of stream, not incrementally.
4. **Max 50 conversations** — oldest is silently dropped when the limit is reached.
5. **tsx watch** — server restarts automatically on `server.ts` changes; browser must
   be refreshed manually after frontend file changes.

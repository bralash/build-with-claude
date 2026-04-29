# Molly — Session Handoff

## What this project is

**Molly** is a Claude-powered Q&A web app built as a 6-week incremental project.
Each week adds a layer of complexity on top of the working foundation.
This handoff covers everything built so far (effectively Weeks 1–2 scope).

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
│   └── server.ts          # Express server + /api/ask endpoint
├── public/
│   ├── index.html         # App shell
│   ├── style.css          # All styles (CSS custom properties for theming)
│   └── app.js             # All client logic
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

- Single endpoint: `POST /api/ask`
- Request body: `{ question: string, persona: string, model: string }`
- Persona selects a system prompt from the `PERSONAS` map
- Model is validated against an allowlist (`ALLOWED_MODELS`); defaults to `claude-sonnet-4-6`
- Response: `{ answer, stop_reason, model }`
- Errors are caught and returned as readable messages (401, 429, 529, 500)

### Personas (personality-based, not domain-based)

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

### Chat UI (like Claude.ai / ChatGPT)
- Full-height layout: sticky topbar → scrollable chat → sticky input bar
- User messages: right-aligned pastel bubble
- Assistant messages: left-aligned, with avatar `M` circle + persona badge + model badge
- Animated thinking dots while the API call is in-flight
- Previous messages persist; new messages append to the thread
- `Enter` sends, `Shift+Enter` inserts a new line
- Textarea auto-grows with content

### Settings panel
- Gear icon in the topbar opens a slide-in right drawer
- **Persona** — 5 text-only cards (no icons); selecting one changes the voice AND the accent colour
- **Appearance** — Light / Dark mode toggle only (no manual colour picker)
- **Streaming** — Toggle rendered as disabled with "Coming soon" badge (to activate in a future week)
- Escape or clicking the overlay closes the panel

### Model selector
- Three pill chips below the input: Haiku · Sonnet · Opus
- Selected chip highlighted in the current accent colour

### Theming system (CSS custom properties)
- `data-theme` on `<html>`: `light` (default) | `dark`
- `data-accent` on `<html>`: set automatically when a persona is selected
- Each persona owns one of the **Embroidery pastel palette** colours:

| Persona | Accent key | Hex |
|---|---|---|
| Casual | `cream` | `#F5EBE0` |
| Playful | `coral` | `#FEC5BB` |
| Professional | `taupe` | `#DED6CE` |
| Creative | `pink` | `#FAE1DD` |
| Mentor | `sage` | `#D8E2DC` |

- The accent tokens (`--accent-bg`, `--accent-fg`, `--accent-border`, `--accent-subtle`)
  drive: user bubble, send button, model chip active state, persona card active border,
  focus ring, and assistant model badge.
- Dark mode uses warm brown tones (`#18130F` base), not cold grays.
- All dark mode text has been verified for WCAG AA contrast (text-secondary 10.3:1,
  text-muted 6.1:1). Active-state labels in dark mode use `--accent-bg` (the pastel)
  as text colour to avoid dark-on-dark failures.

### LocalStorage keys
- `molly-persona` — active persona key
- `molly-model` — selected model id
- `molly-theme` — `light` | `dark`
- Accent colour is NOT stored — always derived from the active persona on load.

---

## Git state

**Active branch:** `feat/settings-and-model-selector`
**All PRs are merged.** The branch is ahead of `master` by several commits
that have not been merged yet (the merge happened mid-session without rebasing).

To sync:
```bash
git checkout master && git pull
```

Or continue working on `feat/settings-and-model-selector` and open a new PR
targeting `master` for any new work.

### Commit history (newest first)
```
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

The course runs 6 weeks. Planned upcoming features include:

- **Streaming responses** — the toggle is already wired in the UI, disabled.
  Next step: implement SSE or streaming fetch on the backend and flip the toggle live.
- **Conversation memory / multi-turn** — currently each request is stateless
  (single-turn). A future week will pass the full conversation history to the API.
- **Prompt caching** — add Anthropic prompt caching headers to reduce latency
  and cost on repeated system prompts.
- Possibly: **tool use**, **file uploads**, or other API features.

---

## Known quirks

1. `dotenv.config({ override: true })` — see dotenv section above.
2. The `feat/settings-and-model-selector` branch has commits beyond what's
   merged into `master`. Check `git log origin/master..HEAD` before starting.
3. The server must be restarted (`npm run dev`) after any changes to `server.ts`;
   tsx watch handles this automatically.

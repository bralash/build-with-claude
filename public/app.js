// ── DOM refs ─────────────────────────────────────────────────────────────────
const questionEl         = document.getElementById("question");
const askBtn             = document.getElementById("ask-btn");
const chatMessages       = document.getElementById("chat-messages");
const emptyState         = document.getElementById("empty-state");
const emptySub           = document.getElementById("empty-sub");
const activePersonaBadge = document.getElementById("active-persona-badge");
const modelChipsEl       = document.getElementById("model-chips");
const settingsOpenBtn    = document.getElementById("settings-open");
const settingsCloseBtn   = document.getElementById("settings-close");
const settingsPanel      = document.getElementById("settings-panel");
const settingsOverlay    = document.getElementById("settings-overlay");
const personaListEl      = document.getElementById("persona-list");
const swatchGrid         = document.getElementById("swatch-grid");
const themeLightBtn      = document.getElementById("theme-light");
const themeDarkBtn       = document.getElementById("theme-dark");

// ── Config ────────────────────────────────────────────────────────────────────
const PERSONA_META = {
  technical: {
    label: "Technical & Code",
    desc:  "Programming, debugging, system design, and software best practices.",
  },
  marketing: {
    label: "Marketing",
    desc:  "Brand strategy, copywriting, campaigns, and go-to-market planning.",
  },
  hr: {
    label: "Human Resources",
    desc:  "Employee relations, HR policies, onboarding, and workplace culture.",
  },
  training: {
    label: "Training & Teaching",
    desc:  "Curricula, lesson plans, and clear explanations for any skill level.",
  },
  recruitment: {
    label: "Recruitment",
    desc:  "Job descriptions, interview frameworks, and employer branding.",
  },
};

const MODEL_META = {
  "claude-haiku-4-5":  { label: "Haiku"  },
  "claude-sonnet-4-6": { label: "Sonnet" },
  "claude-opus-4-5":   { label: "Opus"   },
};

const ACCENT_META = {
  coral:  { color: "#FEC5BB", label: "Coral"  },
  sage:   { color: "#D8E2DC", label: "Sage"   },
  blush:  { color: "#F8EDEB", label: "Blush"  },
  pink:   { color: "#FAE1DD", label: "Rose"   },
  taupe:  { color: "#DED6CE", label: "Taupe"  },
  cream:  { color: "#F5EBE0", label: "Cream"  },
};

const DEFAULT_PERSONA = "technical";
const DEFAULT_MODEL   = "claude-sonnet-4-6";
const DEFAULT_ACCENT  = "coral";
const DEFAULT_THEME   = "light";

// ── State (loaded from localStorage) ─────────────────────────────────────────
let currentPersona = localStorage.getItem("devq-persona") || DEFAULT_PERSONA;
let currentModel   = localStorage.getItem("devq-model")   || DEFAULT_MODEL;
let currentAccent  = localStorage.getItem("devq-accent")  || DEFAULT_ACCENT;
let currentTheme   = localStorage.getItem("devq-theme")   || DEFAULT_THEME;

// ── Boot ──────────────────────────────────────────────────────────────────────
(function init() {
  applyTheme(currentTheme);
  applyAccent(currentAccent);
  buildPersonaList();
  applyPersona(currentPersona);
  applyModel(currentModel);
  buildSwatches();
})();

// ── Settings panel ────────────────────────────────────────────────────────────
settingsOpenBtn.addEventListener("click", openSettings);
settingsCloseBtn.addEventListener("click", closeSettings);
settingsOverlay.addEventListener("click", closeSettings);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSettings(); });

function openSettings() {
  settingsPanel.classList.add("open");
  settingsOverlay.classList.add("open");
  settingsPanel.setAttribute("aria-hidden", "false");
}

function closeSettings() {
  settingsPanel.classList.remove("open");
  settingsOverlay.classList.remove("open");
  settingsPanel.setAttribute("aria-hidden", "true");
}

// ── Theme ─────────────────────────────────────────────────────────────────────
themeLightBtn.addEventListener("click", () => selectTheme("light"));
themeDarkBtn.addEventListener("click",  () => selectTheme("dark"));

function selectTheme(theme) {
  currentTheme = theme;
  localStorage.setItem("devq-theme", theme);
  applyTheme(theme);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeLightBtn.classList.toggle("active", theme === "light");
  themeDarkBtn.classList.toggle("active",  theme === "dark");
}

// ── Accent colour ─────────────────────────────────────────────────────────────
function buildSwatches() {
  swatchGrid.innerHTML = "";
  Object.entries(ACCENT_META).forEach(([key, meta]) => {
    const btn = document.createElement("button");
    btn.className   = "swatch" + (key === currentAccent ? " active" : "");
    btn.style.background = meta.color;
    btn.title       = meta.label;
    btn.setAttribute("aria-label", meta.label);
    btn.addEventListener("click", () => selectAccent(key));
    swatchGrid.appendChild(btn);
  });
}

function selectAccent(key) {
  currentAccent = key;
  localStorage.setItem("devq-accent", key);
  applyAccent(key);
  // refresh swatch active states
  swatchGrid.querySelectorAll(".swatch").forEach((s, i) => {
    s.classList.toggle("active", Object.keys(ACCENT_META)[i] === key);
  });
}

function applyAccent(key) {
  document.documentElement.dataset.accent = key || DEFAULT_ACCENT;
}

// ── Persona ───────────────────────────────────────────────────────────────────
function buildPersonaList() {
  personaListEl.innerHTML = "";
  Object.entries(PERSONA_META).forEach(([key, meta]) => {
    const card = document.createElement("button");
    card.className   = "persona-card" + (key === currentPersona ? " active" : "");
    card.dataset.persona = key;
    card.innerHTML   = `
      <span class="persona-card-name">${meta.label}</span>
      <span class="persona-card-desc">${meta.desc}</span>`;
    card.addEventListener("click", () => selectPersona(key));
    personaListEl.appendChild(card);
  });
}

function selectPersona(key) {
  currentPersona = key;
  localStorage.setItem("devq-persona", key);
  applyPersona(key);
  buildPersonaList();
}

function applyPersona(key) {
  const meta = PERSONA_META[key] || PERSONA_META[DEFAULT_PERSONA];
  activePersonaBadge.textContent = meta.label;
  emptySub.textContent           = meta.desc;
}

// ── Model selector ────────────────────────────────────────────────────────────
modelChipsEl.querySelectorAll(".model-chip").forEach((chip) => {
  chip.addEventListener("click", () => selectModel(chip.dataset.model));
});

function selectModel(modelId) {
  if (!MODEL_META[modelId]) return;
  currentModel = modelId;
  localStorage.setItem("devq-model", modelId);
  applyModel(modelId);
}

function applyModel(modelId) {
  modelChipsEl.querySelectorAll(".model-chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.model === modelId);
  });
}

// ── Textarea auto-grow ────────────────────────────────────────────────────────
questionEl.addEventListener("input", () => {
  questionEl.style.height = "auto";
  questionEl.style.height = questionEl.scrollHeight + "px";
});

questionEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askQuestion(); }
});

askBtn.addEventListener("click", askQuestion);

// ── Core ask ──────────────────────────────────────────────────────────────────
async function askQuestion() {
  const question = questionEl.value.trim();
  if (!question) return;

  emptyState.style.display = "none";

  appendUserMessage(question);
  questionEl.value = "";
  questionEl.style.height = "auto";
  setLoading(true);

  const pair         = document.createElement("div");
  pair.className     = "message-pair";
  const assistantEl  = buildAssistantShell(currentPersona, currentModel);
  const bodyEl       = assistantEl.querySelector(".assistant-body");
  const thinkingEl   = Object.assign(document.createElement("div"), { className: "thinking" });
  thinkingEl.innerHTML = "<span></span><span></span><span></span>";
  bodyEl.appendChild(thinkingEl);
  pair.appendChild(assistantEl);
  chatMessages.appendChild(pair);
  scrollToBottom();

  try {
    const res  = await fetch("/api/ask", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ question, persona: currentPersona, model: currentModel }),
    });

    const data = await res.json();
    thinkingEl.remove();

    const contentEl = document.createElement("div");
    if (!res.ok) {
      contentEl.className   = "error-bubble";
      contentEl.textContent = data.error ?? "An unknown error occurred.";
    } else {
      contentEl.className = "answer";
      contentEl.innerHTML = marked.parse(data.answer);
    }
    bodyEl.appendChild(contentEl);
  } catch {
    thinkingEl.remove();
    const errEl = Object.assign(document.createElement("div"), {
      className: "error-bubble",
      textContent: "Network error — could not reach the server.",
    });
    bodyEl.appendChild(errEl);
  } finally {
    setLoading(false);
    scrollToBottom();
  }
}

// ── DOM helpers ───────────────────────────────────────────────────────────────
function appendUserMessage(text) {
  const pair     = document.createElement("div");
  pair.className = "message-pair";
  const msg      = document.createElement("div");
  msg.className  = "user-message";
  const bubble   = Object.assign(document.createElement("div"), {
    className: "user-bubble",
    textContent: text,
  });
  msg.appendChild(bubble);
  pair.appendChild(msg);
  chatMessages.appendChild(pair);
  scrollToBottom();
}

function buildAssistantShell(persona, modelId) {
  const personaMeta = PERSONA_META[persona]   || PERSONA_META[DEFAULT_PERSONA];
  const modelMeta   = MODEL_META[modelId]     || MODEL_META[DEFAULT_MODEL];

  const wrapper  = document.createElement("div");
  wrapper.className = "assistant-message";

  const avatar   = Object.assign(document.createElement("div"), {
    className: "assistant-avatar",
    textContent: "D",
  });

  const body     = document.createElement("div");
  body.className = "assistant-body";

  const header   = document.createElement("div");
  header.className = "assistant-header";
  header.innerHTML = `
    <span class="assistant-name">DevQ</span>
    <span class="persona-badge">${personaMeta.label}</span>
    <span class="model-badge">${modelMeta.label}</span>`;

  body.appendChild(header);
  wrapper.appendChild(avatar);
  wrapper.appendChild(body);
  return wrapper;
}

function scrollToBottom() { chatMessages.scrollTop = chatMessages.scrollHeight; }

function setLoading(on) {
  askBtn.disabled     = on;
  questionEl.disabled = on;
}

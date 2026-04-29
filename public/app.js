// ── DOM refs ──────────────────────────────────────────────────────────────────
const questionEl        = document.getElementById("question");
const askBtn            = document.getElementById("ask-btn");
const chatMessages      = document.getElementById("chat-messages");
const emptyState        = document.getElementById("empty-state");
const emptySub          = document.getElementById("empty-sub");
const activePersonaBadge= document.getElementById("active-persona-badge");
const modelChipsEl      = document.getElementById("model-chips");
const settingsOpenBtn   = document.getElementById("settings-open");
const settingsCloseBtn  = document.getElementById("settings-close");
const settingsPanel     = document.getElementById("settings-panel");
const settingsOverlay   = document.getElementById("settings-overlay");
const personaListEl     = document.getElementById("persona-list");
const themeDarkBtn      = document.getElementById("theme-dark");
const themeLightBtn     = document.getElementById("theme-light");

// ── State ─────────────────────────────────────────────────────────────────────
const PERSONA_META = {
  technical:   {
    icon:  "💻",
    label: "Technical & Code",
    desc:  "Programming, debugging, system design, and software best practices.",
  },
  marketing:   {
    icon:  "📣",
    label: "Marketing",
    desc:  "Brand strategy, copywriting, campaigns, and go-to-market planning.",
  },
  hr:          {
    icon:  "🤝",
    label: "Human Resources",
    desc:  "Employee relations, HR policies, onboarding, and workplace culture.",
  },
  training:    {
    icon:  "🎓",
    label: "Training & Teaching",
    desc:  "Curricula, lesson plans, and explanations for any skill level.",
  },
  recruitment: {
    icon:  "🔍",
    label: "Recruitment",
    desc:  "Job descriptions, interview frameworks, and employer branding.",
  },
};

const MODEL_META = {
  "claude-haiku-4-5":  { label: "Haiku",  icon: "⚡" },
  "claude-sonnet-4-6": { label: "Sonnet", icon: "✦" },
  "claude-opus-4-5":   { label: "Opus",   icon: "🧠" },
};

const DEFAULT_PERSONA = "technical";
const DEFAULT_MODEL   = "claude-sonnet-4-6";

let currentPersona = localStorage.getItem("devq-persona") || DEFAULT_PERSONA;
let currentModel   = localStorage.getItem("devq-model")   || DEFAULT_MODEL;
let currentTheme   = localStorage.getItem("devq-theme")   || "dark";

// ── Boot ──────────────────────────────────────────────────────────────────────
(function init() {
  applyTheme(currentTheme);
  buildPersonaList();
  applyPersona(currentPersona);
  applyModel(currentModel);
})();

// ── Settings panel ────────────────────────────────────────────────────────────
settingsOpenBtn.addEventListener("click", openSettings);
settingsCloseBtn.addEventListener("click", closeSettings);
settingsOverlay.addEventListener("click", closeSettings);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSettings();
});

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

// ── Persona ───────────────────────────────────────────────────────────────────
function buildPersonaList() {
  personaListEl.innerHTML = "";
  Object.entries(PERSONA_META).forEach(([key, meta]) => {
    const card = document.createElement("button");
    card.className   = "persona-card" + (key === currentPersona ? " active" : "");
    card.dataset.persona = key;
    card.innerHTML = `
      <span class="persona-card-icon">${meta.icon}</span>
      <span class="persona-card-text">
        <span class="persona-card-name">${meta.label}</span>
        <span class="persona-card-desc">${meta.desc}</span>
      </span>`;
    card.addEventListener("click", () => selectPersona(key));
    personaListEl.appendChild(card);
  });
}

function selectPersona(key) {
  currentPersona = key;
  localStorage.setItem("devq-persona", key);
  applyPersona(key);
  buildPersonaList(); // refresh active state
}

function applyPersona(key) {
  const meta = PERSONA_META[key] || PERSONA_META[DEFAULT_PERSONA];
  activePersonaBadge.textContent = `${meta.icon} ${meta.label}`;
  emptySub.textContent = meta.desc;
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

// ── Theme ─────────────────────────────────────────────────────────────────────
themeDarkBtn.addEventListener("click",  () => selectTheme("dark"));
themeLightBtn.addEventListener("click", () => selectTheme("light"));

function selectTheme(theme) {
  currentTheme = theme;
  localStorage.setItem("devq-theme", theme);
  applyTheme(theme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeDarkBtn.classList.toggle("active",  theme === "dark");
  themeLightBtn.classList.toggle("active", theme === "light");
}

// ── Input auto-grow ───────────────────────────────────────────────────────────
questionEl.addEventListener("input", () => {
  questionEl.style.height = "auto";
  questionEl.style.height = questionEl.scrollHeight + "px";
});

questionEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    askQuestion();
  }
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

  const pair        = document.createElement("div");
  pair.className    = "message-pair";
  const assistantEl = buildAssistantShell(currentPersona, currentModel);
  const bodyEl      = assistantEl.querySelector(".assistant-body");

  const thinkingEl  = document.createElement("div");
  thinkingEl.className = "thinking";
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

    if (!res.ok) {
      const errEl = document.createElement("div");
      errEl.className   = "error-bubble";
      errEl.textContent = data.error ?? "An unknown error occurred.";
      bodyEl.appendChild(errEl);
    } else {
      const answerEl = document.createElement("div");
      answerEl.className = "answer";
      answerEl.innerHTML = marked.parse(data.answer);
      bodyEl.appendChild(answerEl);
    }
  } catch {
    thinkingEl.remove();
    const errEl = document.createElement("div");
    errEl.className   = "error-bubble";
    errEl.textContent = "Network error — could not reach the server.";
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

  const bubble   = document.createElement("div");
  bubble.className   = "user-bubble";
  bubble.textContent = text;

  msg.appendChild(bubble);
  pair.appendChild(msg);
  chatMessages.appendChild(pair);
  scrollToBottom();
}

function buildAssistantShell(persona, modelId) {
  const personaMeta = PERSONA_META[persona]  || PERSONA_META[DEFAULT_PERSONA];
  const modelMeta   = MODEL_META[modelId]    || MODEL_META[DEFAULT_MODEL];

  const wrapper = document.createElement("div");
  wrapper.className = "assistant-message";

  const avatar       = document.createElement("div");
  avatar.className   = "assistant-avatar";
  avatar.textContent = "D";

  const body         = document.createElement("div");
  body.className     = "assistant-body";

  const header       = document.createElement("div");
  header.className   = "assistant-header";

  const name         = document.createElement("span");
  name.className     = "assistant-name";
  name.textContent   = "DevQ";

  const pBadge       = document.createElement("span");
  pBadge.className   = "persona-badge";
  pBadge.textContent = `${personaMeta.icon} ${personaMeta.label}`;

  const mBadge       = document.createElement("span");
  mBadge.className   = "model-badge";
  mBadge.textContent = `${modelMeta.icon} ${modelMeta.label}`;

  header.appendChild(name);
  header.appendChild(pBadge);
  header.appendChild(mBadge);
  body.appendChild(header);
  wrapper.appendChild(avatar);
  wrapper.appendChild(body);
  return wrapper;
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setLoading(on) {
  askBtn.disabled     = on;
  questionEl.disabled = on;
}

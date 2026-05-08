// ── DOM refs ─────────────────────────────────────────────────────────────────
const questionEl          = document.getElementById("question");
const askBtn              = document.getElementById("ask-btn");
const chatMessages        = document.getElementById("chat-messages");
const emptyState          = document.getElementById("empty-state");
const emptySub            = document.getElementById("empty-sub");
const activePersonaBadge  = document.getElementById("active-persona-badge");
const modelChipsEl        = document.getElementById("model-chips");
const settingsOpenBtn     = document.getElementById("settings-open");
const settingsCloseBtn    = document.getElementById("settings-close");
const settingsPanel       = document.getElementById("settings-panel");
const settingsOverlay     = document.getElementById("settings-overlay");
const personaListEl       = document.getElementById("persona-list");
const themeLightBtn       = document.getElementById("theme-light");
const themeDarkBtn        = document.getElementById("theme-dark");
const streamingToggle     = document.getElementById("streaming-toggle");
const conversationToggle  = document.getElementById("conversation-toggle");
const newChatBtn          = document.getElementById("new-chat-btn");
const analyzeBtn          = document.getElementById("analyze-btn");
const factsBtn            = document.getElementById("facts-btn");

// ── Config ────────────────────────────────────────────────────────────────────
const PERSONA_META = {
  casual: {
    label:       "Casual",
    desc:        "Relaxed and conversational — like chatting with a friend.",
    accent:      "cream",
    placeholder: "What's on your mind?",
  },
  playful: {
    label:       "Playful",
    desc:        "Upbeat and fun — keeps things light and entertaining.",
    accent:      "coral",
    placeholder: "What are we getting into today?",
  },
  professional: {
    label:       "Professional",
    desc:        "Formal and precise — structured, clear, and authoritative.",
    accent:      "taupe",
    placeholder: "State your question.",
  },
  creative: {
    label:       "Creative",
    desc:        "Imaginative and expressive — explores ideas from fresh angles.",
    accent:      "pink",
    placeholder: "What idea shall we explore?",
  },
  mentor: {
    label:       "Mentor",
    desc:        "Patient and encouraging — builds understanding, not just answers.",
    accent:      "sage",
    placeholder: "What would you like to understand?",
  },
};

const MODEL_META = {
  "claude-haiku-4-5":  { label: "Haiku"  },
  "claude-sonnet-4-6": { label: "Sonnet" },
  "claude-opus-4-5":   { label: "Opus"   },
};

const DEFAULT_PERSONA = "casual";
const DEFAULT_MODEL   = "claude-sonnet-4-6";
const DEFAULT_THEME   = "light";

// ── State (loaded from localStorage) ─────────────────────────────────────────
let currentPersona        = localStorage.getItem("molly-persona")      || DEFAULT_PERSONA;
let currentModel          = localStorage.getItem("molly-model")        || DEFAULT_MODEL;
let currentTheme          = localStorage.getItem("molly-theme")        || DEFAULT_THEME;
let streamingEnabled      = localStorage.getItem("molly-streaming")    === "true";
let conversationEnabled   = localStorage.getItem("molly-conversation") === "true";

// ── Conversation history (in-memory only) ─────────────────────────────────────
let conversationHistory = [];

// ── Boot ──────────────────────────────────────────────────────────────────────
(function init() {
  applyTheme(currentTheme);
  buildPersonaList();
  applyPersona(currentPersona);
  applyModel(currentModel);
  applyStreaming(streamingEnabled);
  applyConversation(conversationEnabled);
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
  localStorage.setItem("molly-theme", theme);
  applyTheme(theme);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeLightBtn.classList.toggle("active", theme === "light");
  themeDarkBtn.classList.toggle("active",  theme === "dark");
}

// ── Streaming toggle ──────────────────────────────────────────────────────────
streamingToggle.addEventListener("click", () => {
  streamingEnabled = !streamingEnabled;
  localStorage.setItem("molly-streaming", streamingEnabled);
  applyStreaming(streamingEnabled);
});

function applyStreaming(enabled) {
  streamingToggle.setAttribute("aria-checked", enabled ? "true" : "false");
  streamingToggle.classList.toggle("active", enabled);
}

// ── Conversation toggle ───────────────────────────────────────────────────────
conversationToggle.addEventListener("click", () => {
  conversationEnabled = !conversationEnabled;
  localStorage.setItem("molly-conversation", conversationEnabled);
  if (!conversationEnabled) clearHistory();
  applyConversation(conversationEnabled);
});

newChatBtn.addEventListener("click", () => {
  clearHistory();
  clearChatUI();
});

function applyConversation(enabled) {
  conversationToggle.setAttribute("aria-checked", enabled ? "true" : "false");
  conversationToggle.classList.toggle("active", enabled);
  newChatBtn.hidden = !enabled;
}

function clearHistory() {
  conversationHistory = [];
}

function clearChatUI() {
  chatMessages.innerHTML = "";
  chatMessages.appendChild(emptyState);
  emptyState.style.display = "";
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
  localStorage.setItem("molly-persona", key);
  applyPersona(key);
  buildPersonaList();
}

function applyPersona(key) {
  const meta = PERSONA_META[key] || PERSONA_META[DEFAULT_PERSONA];
  document.documentElement.dataset.accent = meta.accent;
  activePersonaBadge.textContent  = meta.label;
  emptySub.textContent            = meta.desc;
  questionEl.placeholder          = meta.placeholder;
}

// ── Model selector ────────────────────────────────────────────────────────────
modelChipsEl.querySelectorAll(".model-chip").forEach((chip) => {
  chip.addEventListener("click", () => selectModel(chip.dataset.model));
});

function selectModel(modelId) {
  if (!MODEL_META[modelId]) return;
  currentModel = modelId;
  localStorage.setItem("molly-model", modelId);
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

  // Build the messages array for this request
  if (conversationEnabled) {
    conversationHistory.push({ role: "user", content: question });
  }
  const messages = conversationEnabled
    ? [...conversationHistory]
    : [{ role: "user", content: question }];

  const pair        = document.createElement("div");
  pair.className    = "message-pair";
  const assistantEl = buildAssistantShell(currentPersona, currentModel);
  const bodyEl      = assistantEl.querySelector(".assistant-body");
  const thinkingEl  = Object.assign(document.createElement("div"), { className: "thinking" });
  thinkingEl.innerHTML = "<span></span><span></span><span></span>";
  bodyEl.appendChild(thinkingEl);
  pair.appendChild(assistantEl);
  chatMessages.appendChild(pair);
  scrollToBottom();

  let assistantReply = "";

  if (streamingEnabled) {
    assistantReply = await askStreaming(messages, bodyEl, thinkingEl);
  } else {
    assistantReply = await askBatch(messages, bodyEl, thinkingEl);
  }

  // Record the assistant turn so future messages carry the full thread
  if (conversationEnabled && assistantReply) {
    conversationHistory.push({ role: "assistant", content: assistantReply });
  }

  setLoading(false);
  scrollToBottom();
}

async function askBatch(messages, bodyEl, thinkingEl) {
  try {
    const res  = await fetch("/api/ask", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ messages, persona: currentPersona, model: currentModel }),
    });

    const data = await res.json();
    thinkingEl.remove();

    const contentEl = document.createElement("div");
    if (!res.ok) {
      contentEl.className   = "error-bubble";
      contentEl.textContent = data.error ?? "An unknown error occurred.";
      bodyEl.appendChild(contentEl);
      return "";
    }

    contentEl.className = "answer";
    contentEl.innerHTML = marked.parse(data.answer);
    bodyEl.appendChild(contentEl);
    return data.answer;
  } catch {
    thinkingEl.remove();
    const errEl = Object.assign(document.createElement("div"), {
      className: "error-bubble",
      textContent: "Network error — could not reach the server.",
    });
    bodyEl.appendChild(errEl);
    return "";
  }
}

async function askStreaming(messages, bodyEl, thinkingEl) {
  const contentEl = document.createElement("div");
  contentEl.className = "answer streaming";
  const cursorEl = document.createElement("span");
  cursorEl.className = "stream-cursor";
  let rawText = "";
  let firstChunk = true;

  try {
    const res = await fetch("/api/ask-stream", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ messages, persona: currentPersona, model: currentModel }),
    });

    if (!res.ok) {
      thinkingEl.remove();
      const errEl = Object.assign(document.createElement("div"), {
        className: "error-bubble",
        textContent: "Stream error — could not reach the server.",
      });
      bodyEl.appendChild(errEl);
      return "";
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer    = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = JSON.parse(line.slice(6));

        if (payload.type === "delta") {
          if (firstChunk) {
            thinkingEl.remove();
            contentEl.appendChild(cursorEl);
            bodyEl.appendChild(contentEl);
            firstChunk = false;
          }
          rawText += payload.text;
          const chunk = document.createElement("span");
          chunk.className = "chunk-token";
          chunk.textContent = payload.text;
          contentEl.insertBefore(chunk, cursorEl);
          scrollToBottom();
        } else if (payload.type === "done") {
          cursorEl.remove();
          contentEl.classList.remove("streaming");
          contentEl.innerHTML = marked.parse(rawText);
        } else if (payload.type === "error") {
          thinkingEl.remove();
          cursorEl.remove();
          const errEl = Object.assign(document.createElement("div"), {
            className: "error-bubble",
            textContent: payload.message,
          });
          bodyEl.appendChild(errEl);
          return "";
        }
      }
    }

    // Fallback: ensure markdown is rendered if done event wasn't received
    if (!firstChunk && contentEl.classList.contains("streaming")) {
      cursorEl.remove();
      contentEl.classList.remove("streaming");
      contentEl.innerHTML = marked.parse(rawText);
    }
  } catch {
    thinkingEl.remove();
    const errEl = Object.assign(document.createElement("div"), {
      className: "error-bubble",
      textContent: "Network error — could not reach the server.",
    });
    bodyEl.appendChild(errEl);
    return "";
  }

  return rawText;
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

function buildAssistantShell(persona, modelId, actionLabel) {
  const personaMeta = PERSONA_META[persona]   || PERSONA_META[DEFAULT_PERSONA];
  const modelMeta   = MODEL_META[modelId]     || MODEL_META[DEFAULT_MODEL];

  const wrapper  = document.createElement("div");
  wrapper.className = "assistant-message";

  const avatar   = Object.assign(document.createElement("div"), {
    className: "assistant-avatar",
    textContent: "M",
  });

  const body     = document.createElement("div");
  body.className = "assistant-body";

  const header   = document.createElement("div");
  header.className = "assistant-header";
  const actionBadgeHtml = actionLabel
    ? `<span class="tool-badge">${actionLabel}</span>`
    : "";
  header.innerHTML = `
    <span class="assistant-name">Molly</span>
    <span class="persona-badge">${personaMeta.label}</span>
    <span class="model-badge">${modelMeta.label}</span>
    ${actionBadgeHtml}`;

  body.appendChild(header);
  wrapper.appendChild(avatar);
  wrapper.appendChild(body);
  return wrapper;
}

function scrollToBottom() { chatMessages.scrollTop = chatMessages.scrollHeight; }

function setLoading(on) {
  askBtn.disabled     = on;
  questionEl.disabled = on;
  analyzeBtn.disabled = on;
  factsBtn.disabled   = on;
}

// ── Feature 1: Structured JSON Analyze ───────────────────────────────────────
analyzeBtn.addEventListener("click", runAnalyze);

async function runAnalyze() {
  const question = questionEl.value.trim();
  if (!question) return;

  emptyState.style.display = "none";
  appendUserMessage(question);
  questionEl.value = "";
  questionEl.style.height = "auto";
  setLoading(true);

  const pair        = document.createElement("div");
  pair.className    = "message-pair";
  const assistantEl = buildAssistantShell(currentPersona, currentModel, "Analyze");
  const bodyEl      = assistantEl.querySelector(".assistant-body");
  const thinkingEl  = Object.assign(document.createElement("div"), { className: "thinking" });
  thinkingEl.innerHTML = "<span></span><span></span><span></span>";
  bodyEl.appendChild(thinkingEl);
  pair.appendChild(assistantEl);
  chatMessages.appendChild(pair);
  scrollToBottom();

  try {
    const res  = await fetch("/api/analyze", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ question, model: currentModel }),
    });

    const data = await res.json();
    thinkingEl.remove();

    if (!res.ok) {
      const errEl = Object.assign(document.createElement("div"), {
        className: "error-bubble",
        textContent: data.error ?? "An unknown error occurred.",
      });
      bodyEl.appendChild(errEl);
      return;
    }

    bodyEl.appendChild(buildAnalysisCard(data.analysis));
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

function buildAnalysisCard(a) {
  const card = document.createElement("div");
  card.className = "analysis-card";

  // Title
  const title = Object.assign(document.createElement("div"), {
    className: "analysis-title",
    textContent: a.title ?? "Analysis",
  });
  card.appendChild(title);

  // Key points
  if (Array.isArray(a.keyPoints) && a.keyPoints.length > 0) {
    const section = document.createElement("div");
    const label   = Object.assign(document.createElement("span"), {
      className: "analysis-label",
      textContent: "Key Points",
    });
    const list = document.createElement("ul");
    list.className = "analysis-key-points";
    a.keyPoints.forEach((pt) => {
      const li = Object.assign(document.createElement("li"), { textContent: pt });
      list.appendChild(li);
    });
    section.appendChild(label);
    section.appendChild(list);
    card.appendChild(section);
  }

  // Meta row: sentiment + confidence + isQuestion
  const meta = document.createElement("div");
  meta.className = "analysis-meta";

  const sentiment = String(a.sentiment ?? "neutral").toLowerCase();
  const sentimentBadge = Object.assign(document.createElement("span"), {
    className: `sentiment-badge ${sentiment}`,
    textContent: sentiment.charAt(0).toUpperCase() + sentiment.slice(1),
  });
  meta.appendChild(sentimentBadge);

  const confidence = typeof a.confidence === "number"
    ? Math.max(0, Math.min(100, Math.round(a.confidence)))
    : 0;

  const confWrap = document.createElement("div");
  confWrap.className = "confidence-wrap";
  const bar = document.createElement("div");
  bar.className = "confidence-bar";
  const fill = document.createElement("div");
  fill.className = "confidence-fill";
  fill.style.width = `${confidence}%`;
  bar.appendChild(fill);
  const pct = Object.assign(document.createElement("span"), {
    className: "confidence-pct",
    textContent: `${confidence}%`,
  });
  confWrap.appendChild(bar);
  confWrap.appendChild(pct);
  meta.appendChild(confWrap);

  if (a.isQuestion === true) {
    const qBadge = Object.assign(document.createElement("span"), {
      className: "question-badge",
      textContent: "Question",
    });
    meta.appendChild(qBadge);
  }

  card.appendChild(meta);
  return card;
}

// ── Feature 2: Tool Use — Facts Lookup ───────────────────────────────────────
factsBtn.addEventListener("click", runFactsLookup);

async function runFactsLookup() {
  const question = questionEl.value.trim();
  if (!question) return;

  emptyState.style.display = "none";
  appendUserMessage(question);
  questionEl.value = "";
  questionEl.style.height = "auto";
  setLoading(true);

  const pair        = document.createElement("div");
  pair.className    = "message-pair";
  const assistantEl = buildAssistantShell(currentPersona, currentModel, "Facts");
  const bodyEl      = assistantEl.querySelector(".assistant-body");
  const thinkingEl  = Object.assign(document.createElement("div"), { className: "thinking" });
  thinkingEl.innerHTML = "<span></span><span></span><span></span>";
  bodyEl.appendChild(thinkingEl);
  pair.appendChild(assistantEl);
  chatMessages.appendChild(pair);
  scrollToBottom();

  try {
    const res  = await fetch("/api/tool-ask", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ question, model: currentModel }),
    });

    const data = await res.json();
    thinkingEl.remove();

    const contentEl = document.createElement("div");
    if (!res.ok) {
      contentEl.className   = "error-bubble";
      contentEl.textContent = data.error ?? "An unknown error occurred.";
      bodyEl.appendChild(contentEl);
      return;
    }

    contentEl.className = "answer";
    contentEl.innerHTML = marked.parse(data.answer);
    bodyEl.appendChild(contentEl);

    if (data.toolUsed) {
      const assistantHeader = assistantEl.querySelector(".assistant-header");
      const toolBadge = Object.assign(document.createElement("span"), {
        className: "tool-badge",
        textContent: `⚙ ${data.toolUsed}`,
      });
      assistantHeader.appendChild(toolBadge);
    }
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

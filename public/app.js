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
const conversationListEl  = document.getElementById("conversation-list");

// ── Info panel refs ───────────────────────────────────────────────────────────
const infoMsgCount        = document.getElementById("info-msg-count");
const infoTokensIn        = document.getElementById("info-tokens-in");
const infoTokensOut       = document.getElementById("info-tokens-out");
const infoTokensTotal     = document.getElementById("info-tokens-total");
const infoLastTurnSection = document.getElementById("info-last-turn-section");
const infoLastIn          = document.getElementById("info-last-in");
const infoLastOut         = document.getElementById("info-last-out");
const infoModel           = document.getElementById("info-model");
const infoPersona         = document.getElementById("info-persona");
const infoMemory          = document.getElementById("info-memory");

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
const MAX_CONVERSATIONS = 50;

// ── Preferences (localStorage) ────────────────────────────────────────────────
let currentPersona      = localStorage.getItem("molly-persona")      || DEFAULT_PERSONA;
let currentModel        = localStorage.getItem("molly-model")        || DEFAULT_MODEL;
let currentTheme        = localStorage.getItem("molly-theme")        || DEFAULT_THEME;
let streamingEnabled    = localStorage.getItem("molly-streaming")    === "true";
let conversationEnabled = localStorage.getItem("molly-conversation") === "true";

// ── Token tracking (session, not persisted) ───────────────────────────────────
let convTokens = { input: 0, output: 0 };

// ── Conversation store ────────────────────────────────────────────────────────
// Each conversation: { id, title, messages: [{role, content}], updatedAt }
let conversations   = [];
let activeConvId    = null;

function loadConversations() {
  try {
    conversations = JSON.parse(localStorage.getItem("molly-conversations") || "[]");
  } catch {
    conversations = [];
  }
  activeConvId = localStorage.getItem("molly-active-conv") || null;
  // Validate the active id still exists
  if (activeConvId && !conversations.find(c => c.id === activeConvId)) {
    activeConvId = conversations[0]?.id || null;
  }
}

function saveConversations() {
  localStorage.setItem("molly-conversations", JSON.stringify(conversations));
  if (activeConvId) localStorage.setItem("molly-active-conv", activeConvId);
  else localStorage.removeItem("molly-active-conv");
}

function getActiveConversation() {
  return conversations.find(c => c.id === activeConvId) || null;
}

function createConversation(firstMessage) {
  const id = "conv_" + Date.now();
  const title = firstMessage.length > 45
    ? firstMessage.slice(0, 45).trimEnd() + "…"
    : firstMessage;
  const conv = { id, title, messages: [], updatedAt: Date.now() };
  conversations.unshift(conv);          // newest first
  if (conversations.length > MAX_CONVERSATIONS) conversations.pop();
  activeConvId = id;
  saveConversations();
  return conv;
}

function appendToActiveConversation(role, content) {
  const conv = getActiveConversation();
  if (!conv) return;
  conv.messages.push({ role, content });
  conv.updatedAt = Date.now();
  saveConversations();
}

// ── Boot ──────────────────────────────────────────────────────────────────────
(function init() {
  loadConversations();
  applyTheme(currentTheme);
  buildPersonaList();
  applyPersona(currentPersona);
  applyModel(currentModel);
  applyStreaming(streamingEnabled);
  applyConversation(conversationEnabled);
  renderSidebar();
  if (activeConvId) renderConversationInUI(getActiveConversation());
  updateInfoPanel();
})();

// ── Sidebar ───────────────────────────────────────────────────────────────────
function renderSidebar() {
  conversationListEl.innerHTML = "";

  if (conversations.length === 0) {
    const empty = document.createElement("p");
    empty.className = "conv-empty";
    empty.textContent = "No conversations yet.\nStart chatting!";
    conversationListEl.appendChild(empty);
    return;
  }

  conversations.forEach(conv => {
    const btn = document.createElement("button");
    btn.className = "conv-item" + (conv.id === activeConvId ? " active" : "");
    btn.setAttribute("data-id", conv.id);
    btn.setAttribute("title", conv.title);

    const title = document.createElement("span");
    title.className = "conv-item-title";
    title.textContent = conv.title;

    btn.appendChild(title);
    btn.addEventListener("click", () => switchConversation(conv.id));
    conversationListEl.appendChild(btn);
  });
}

function switchConversation(id) {
  if (id === activeConvId) return;
  activeConvId = id;
  localStorage.setItem("molly-active-conv", id);
  convTokens = { input: 0, output: 0 };
  renderSidebar();
  renderConversationInUI(getActiveConversation());
  updateInfoPanel();
}

function renderConversationInUI(conv) {
  // Clear chat area
  chatMessages.innerHTML = "";

  if (!conv || conv.messages.length === 0) {
    chatMessages.appendChild(emptyState);
    emptyState.style.display = "";
    return;
  }

  emptyState.style.display = "none";

  // Pair up user + assistant messages and render them
  let i = 0;
  while (i < conv.messages.length) {
    const pair = document.createElement("div");
    pair.className = "message-pair";

    // User turn
    if (conv.messages[i]?.role === "user") {
      const userDiv  = document.createElement("div");
      userDiv.className = "user-message";
      const bubble = document.createElement("div");
      bubble.className   = "user-bubble";
      bubble.textContent = conv.messages[i].content;
      userDiv.appendChild(bubble);
      pair.appendChild(userDiv);
      i++;
    }

    // Assistant turn (may not exist for the last in-progress turn)
    if (i < conv.messages.length && conv.messages[i]?.role === "assistant") {
      const shell  = buildAssistantShell(currentPersona, currentModel);
      const bodyEl = shell.querySelector(".assistant-body");
      const answerEl = document.createElement("div");
      answerEl.className = "answer";
      answerEl.innerHTML = marked.parse(conv.messages[i].content);
      bodyEl.appendChild(answerEl);
      pair.appendChild(shell);
      i++;
    }

    chatMessages.appendChild(pair);
  }

  scrollToBottom();
}

// ── New chat ──────────────────────────────────────────────────────────────────
newChatBtn.addEventListener("click", startNewChat);

function startNewChat() {
  activeConvId = null;
  convTokens = { input: 0, output: 0 };
  localStorage.removeItem("molly-active-conv");
  renderSidebar();
  chatMessages.innerHTML = "";
  chatMessages.appendChild(emptyState);
  emptyState.style.display = "";
  updateInfoPanel();
}

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

// ── Conversation memory toggle ────────────────────────────────────────────────
conversationToggle.addEventListener("click", () => {
  conversationEnabled = !conversationEnabled;
  localStorage.setItem("molly-conversation", conversationEnabled);
  applyConversation(conversationEnabled);
});

function applyConversation(enabled) {
  conversationToggle.setAttribute("aria-checked", enabled ? "true" : "false");
  conversationToggle.classList.toggle("active", enabled);
  updateInfoPanel();
}

// ── Info panel ────────────────────────────────────────────────────────────────
function fmt(n) { return n.toLocaleString(); }

function updateInfoPanel(lastTurn) {
  const conv     = getActiveConversation();
  const msgCount = conv ? conv.messages.length : 0;
  const totalIn  = convTokens.input;
  const totalOut = convTokens.output;

  infoMsgCount.textContent    = msgCount > 0 ? fmt(msgCount) : "—";
  infoTokensIn.textContent    = totalIn  > 0 ? fmt(totalIn)  : "—";
  infoTokensOut.textContent   = totalOut > 0 ? fmt(totalOut) : "—";
  infoTokensTotal.textContent = (totalIn + totalOut) > 0
    ? fmt(totalIn + totalOut) : "—";

  if (lastTurn) {
    infoLastTurnSection.hidden = false;
    infoLastIn.textContent  = fmt(lastTurn.input_tokens);
    infoLastOut.textContent = fmt(lastTurn.output_tokens);
  }

  const modelMeta = MODEL_META[currentModel] || { label: currentModel };
  infoModel.textContent = modelMeta.label;

  const personaMeta = PERSONA_META[currentPersona] || { label: currentPersona };
  infoPersona.textContent = personaMeta.label;

  infoMemory.innerHTML = conversationEnabled
    ? '<span class="info-badge on">On</span>'
    : '<span class="info-badge">Off</span>';
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
  updateInfoPanel();
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
  updateInfoPanel();
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

  // Create a new conversation on the first message of a session
  if (!activeConvId) createConversation(question);
  appendToActiveConversation("user", question);
  renderSidebar();

  emptyState.style.display = "none";
  appendUserMessage(question);
  questionEl.value = "";
  questionEl.style.height = "auto";
  setLoading(true);

  // Build messages array for the API call
  const conv = getActiveConversation();
  const messages = conversationEnabled
    ? conv.messages.slice()               // full history
    : [{ role: "user", content: question }]; // stateless

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

  // Persist the assistant reply to the conversation store
  if (assistantReply) {
    appendToActiveConversation("assistant", assistantReply);
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

    if (data.usage) {
      convTokens.input  += data.usage.input_tokens;
      convTokens.output += data.usage.output_tokens;
      updateInfoPanel(data.usage);
    }
    return data.answer;
  } catch {
    thinkingEl.remove();
    bodyEl.appendChild(Object.assign(document.createElement("div"), {
      className: "error-bubble",
      textContent: "Network error — could not reach the server.",
    }));
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
      bodyEl.appendChild(Object.assign(document.createElement("div"), {
        className: "error-bubble",
        textContent: "Stream error — could not reach the server.",
      }));
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
          if (payload.usage) {
            convTokens.input  += payload.usage.input_tokens;
            convTokens.output += payload.usage.output_tokens;
            updateInfoPanel(payload.usage);
          }
        } else if (payload.type === "error") {
          thinkingEl.remove();
          cursorEl.remove();
          bodyEl.appendChild(Object.assign(document.createElement("div"), {
            className: "error-bubble",
            textContent: payload.message,
          }));
          return "";
        }
      }
    }

    if (!firstChunk && contentEl.classList.contains("streaming")) {
      cursorEl.remove();
      contentEl.classList.remove("streaming");
      contentEl.innerHTML = marked.parse(rawText);
    }
  } catch {
    thinkingEl.remove();
    bodyEl.appendChild(Object.assign(document.createElement("div"), {
      className: "error-bubble",
      textContent: "Network error — could not reach the server.",
    }));
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

function buildAssistantShell(persona, modelId) {
  const personaMeta = PERSONA_META[persona] || PERSONA_META[DEFAULT_PERSONA];
  const modelMeta   = MODEL_META[modelId]   || MODEL_META[DEFAULT_MODEL];

  const wrapper = document.createElement("div");
  wrapper.className = "assistant-message";

  const avatar = Object.assign(document.createElement("div"), {
    className:   "assistant-avatar",
    textContent: "M",
  });

  const body = document.createElement("div");
  body.className = "assistant-body";

  const header = document.createElement("div");
  header.className = "assistant-header";
  header.innerHTML = `
    <span class="assistant-name">Molly</span>
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

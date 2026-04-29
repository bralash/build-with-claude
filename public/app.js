const questionEl   = document.getElementById("question");
const askBtn       = document.getElementById("ask-btn");
const personaEl    = document.getElementById("persona");
const chatMessages = document.getElementById("chat-messages");
const emptyState   = document.getElementById("empty-state");
const emptySub     = document.getElementById("empty-sub");

const PERSONA_META = {
  technical:   {
    label: "💻 Technical & Code",
    desc:  "Ask anything about programming, debugging, system design, or best practices.",
  },
  marketing:   {
    label: "📣 Marketing",
    desc:  "Brand strategy, copywriting, campaigns, content marketing, and go-to-market.",
  },
  hr:          {
    label: "🤝 Human Resources",
    desc:  "Employee relations, HR policies, onboarding, compliance, and workplace culture.",
  },
  training:    {
    label: "🎓 Training & Teaching",
    desc:  "Curricula, lesson plans, learning objectives, and explanations for any skill level.",
  },
  recruitment: {
    label: "🔍 Recruitment",
    desc:  "Job descriptions, interview frameworks, candidate assessment, and employer branding.",
  },
};

// ── Initialise empty-state description ──────────────────────────────────────
function updateEmptyState() {
  emptySub.textContent = PERSONA_META[personaEl.value].desc;
}

personaEl.addEventListener("change", updateEmptyState);
updateEmptyState();

// ── Auto-grow textarea ───────────────────────────────────────────────────────
questionEl.addEventListener("input", () => {
  questionEl.style.height = "auto";
  questionEl.style.height = questionEl.scrollHeight + "px";
});

// ── Keyboard shortcut: Enter sends, Shift+Enter new line ────────────────────
questionEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    askQuestion();
  }
});

askBtn.addEventListener("click", askQuestion);

// ── Core ask function ────────────────────────────────────────────────────────
async function askQuestion() {
  const question = questionEl.value.trim();
  if (!question) return;

  const persona = personaEl.value;

  // Hide empty state on first message
  emptyState.style.display = "none";

  // Append user bubble
  appendUserMessage(question);

  // Clear + reset input
  questionEl.value = "";
  questionEl.style.height = "auto";
  setLoading(true);

  // Add assistant placeholder (thinking dots)
  const pair       = document.createElement("div");
  pair.className   = "message-pair";
  const assistantEl = buildAssistantShell(persona);
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
      body:    JSON.stringify({ question, persona }),
    });

    const data = await res.json();

    // Replace thinking dots with real content
    thinkingEl.remove();

    if (!res.ok) {
      const errEl = document.createElement("div");
      errEl.className   = "error-bubble";
      errEl.textContent = data.error ?? "An unknown error occurred.";
      bodyEl.appendChild(errEl);
    } else {
      const answerEl = document.createElement("div");
      answerEl.className   = "answer";
      answerEl.innerHTML   = marked.parse(data.answer);
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

// ── DOM helpers ──────────────────────────────────────────────────────────────
function appendUserMessage(text) {
  const pair      = document.createElement("div");
  pair.className  = "message-pair";

  const msg       = document.createElement("div");
  msg.className   = "user-message";

  const bubble    = document.createElement("div");
  bubble.className   = "user-bubble";
  bubble.textContent = text;

  msg.appendChild(bubble);
  pair.appendChild(msg);
  chatMessages.appendChild(pair);
  scrollToBottom();
}

function buildAssistantShell(persona) {
  const wrapper = document.createElement("div");
  wrapper.className = "assistant-message";

  const avatar      = document.createElement("div");
  avatar.className  = "assistant-avatar";
  avatar.textContent = "D";

  const body        = document.createElement("div");
  body.className    = "assistant-body";

  const header      = document.createElement("div");
  header.className  = "assistant-header";

  const name        = document.createElement("span");
  name.className    = "assistant-name";
  name.textContent  = "DevQ";

  const badge       = document.createElement("span");
  badge.className   = "persona-badge";
  badge.textContent = PERSONA_META[persona].label;

  header.appendChild(name);
  header.appendChild(badge);
  body.appendChild(header);
  wrapper.appendChild(avatar);
  wrapper.appendChild(body);
  return wrapper;
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setLoading(on) {
  askBtn.disabled        = on;
  questionEl.disabled    = on;
}

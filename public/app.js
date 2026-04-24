const questionEl = document.getElementById("question");
const askBtn = document.getElementById("ask-btn");
const personaEl = document.getElementById("persona");
const personaDesc = document.getElementById("persona-description");
const responseSection = document.getElementById("response-section");
const answerEl = document.getElementById("answer");
const errorCard = document.getElementById("error-card");
const errorMsg = document.getElementById("error-msg");
const metaModel = document.getElementById("meta-model");
const metaStop = document.getElementById("meta-stop");
const metaPersona = document.getElementById("meta-persona");

const PERSONA_META = {
  technical:   { placeholder: "e.g. What is the difference between a process and a thread?",     desc: "Answers questions about programming, debugging, system design, and software best practices." },
  marketing:   { placeholder: "e.g. Write a tagline for a B2B SaaS product targeting HR teams.",  desc: "Helps with brand strategy, copywriting, campaigns, content marketing, and go-to-market planning." },
  hr:          { placeholder: "e.g. How should I handle a performance improvement plan?",          desc: "Advises on employee relations, HR policies, onboarding, compliance, and workplace culture." },
  training:    { placeholder: "e.g. Design a 4-week onboarding plan for new sales hires.",        desc: "Designs curricula, lesson plans, learning objectives, and clear explanations for any skill level." },
  recruitment: { placeholder: "e.g. Write interview questions for a senior product manager role.", desc: "Assists with job descriptions, interview frameworks, candidate assessment, and employer branding." },
};

function applyPersona() {
  const meta = PERSONA_META[personaEl.value];
  questionEl.placeholder = meta.placeholder;
  personaDesc.textContent = meta.desc;
}

personaEl.addEventListener("change", () => {
  applyPersona();
  responseSection.style.display = "none";
  errorCard.style.display = "none";
});

questionEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) askQuestion();
});

async function askQuestion() {
  const question = questionEl.value.trim();
  if (!question) return;

  const persona = personaEl.value;

  setLoading(true);
  hideAll();

  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, persona }),
    });

    const data = await res.json();

    if (!res.ok) {
      showError(data.error ?? "An unknown error occurred.");
      return;
    }

    answerEl.innerHTML = marked.parse(data.answer);
    metaModel.textContent = `Model: ${data.model}`;
    metaStop.textContent = `Stop reason: ${data.stop_reason}`;
    metaPersona.textContent = `Persona: ${personaEl.options[personaEl.selectedIndex].text}`;
    responseSection.style.display = "block";
  } catch {
    showError("Network error — could not reach the server. Is it running?");
  } finally {
    setLoading(false);
  }
}

function setLoading(on) {
  askBtn.disabled = on;
  askBtn.innerHTML = on
    ? '<span class="spinner"></span>Thinking…'
    : "Ask Claude";
}

function hideAll() {
  responseSection.style.display = "none";
  errorCard.style.display = "none";
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorCard.style.display = "block";
}

// Initialise on load
applyPersona();

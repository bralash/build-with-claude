const questionEl = document.getElementById("question");
const askBtn = document.getElementById("ask-btn");
const responseSection = document.getElementById("response-section");
const answerEl = document.getElementById("answer");
const errorCard = document.getElementById("error-card");
const errorMsg = document.getElementById("error-msg");
const metaModel = document.getElementById("meta-model");
const metaStop = document.getElementById("meta-stop");

questionEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) askQuestion();
});

async function askQuestion() {
  const question = questionEl.value.trim();
  if (!question) return;

  setLoading(true);
  hideAll();

  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    const data = await res.json();

    if (!res.ok) {
      showError(data.error ?? "An unknown error occurred.");
      return;
    }

    answerEl.innerHTML = marked.parse(data.answer);
    metaModel.textContent = `Model: ${data.model}`;
    metaStop.textContent = `Stop reason: ${data.stop_reason}`;
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

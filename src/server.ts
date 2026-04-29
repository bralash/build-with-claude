import dotenv from "dotenv";
dotenv.config({ override: true });
import express, { Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import path from "path";

const app = express();
const port = process.env.PORT ?? 3000;

const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
if (!apiKey) {
  console.error("ERROR: ANTHROPIC_API_KEY is not set. Create a .env file with your key.");
  process.exit(1);
}

const maskedKey = `${apiKey.slice(0, 10)}...${apiKey.slice(-4)}`;
console.log(`API key loaded: ${maskedKey}`);

const client = new Anthropic({ apiKey });

const PERSONAS: Record<string, string> = {
  technical: `You are a knowledgeable and concise technical Q&A assistant. \
Your purpose is to help software developers understand concepts, debug problems, \
and learn best practices across programming languages, frameworks, tools, and system design. \
Answer clearly and directly. Use code examples when they aid understanding. \
If a question is outside your knowledge or ambiguous, say so honestly.`,

  marketing: `You are an expert marketing strategist and copywriter. \
Your purpose is to help with brand strategy, campaign ideation, copywriting, consumer psychology, \
content marketing, SEO, social media, and go-to-market planning. \
Give sharp, actionable advice grounded in real marketing principles. \
When writing copy, produce multiple variations. Be creative but commercially minded.`,

  hr: `You are a seasoned Human Resources professional and advisor. \
Your purpose is to help with employee relations, HR policies, performance management, \
onboarding, workplace compliance, compensation, and organisational culture. \
Give balanced, legally aware advice. Flag when a situation warrants legal counsel. \
Be empathetic and practical — HR issues affect real people.`,

  training: `You are an expert instructional designer and educator. \
Your purpose is to help design training programmes, learning objectives, curricula, \
lesson plans, assessments, and explanations for any topic or skill level. \
Explain concepts clearly, use analogies, and structure content for maximum retention. \
Adapt your style to the learner's level when it is stated.`,

  recruitment: `You are a specialist talent acquisition advisor and recruiter. \
Your purpose is to help with writing job descriptions, screening criteria, interview questions, \
candidate assessment frameworks, employer branding, offer strategy, and pipeline management. \
Give practical, bias-aware advice. Help identify what great candidates look like \
and how to attract and assess them effectively.`,
};

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.post("/api/ask", async (req: Request, res: Response): Promise<void> => {
  const { question, persona } = req.body as { question?: string; persona?: string };

  if (!question || question.trim() === "") {
    res.status(400).json({ error: "Question is required." });
    return;
  }

  const systemPrompt = PERSONAS[persona ?? ""] ?? PERSONAS.technical;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: question.trim() }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const answer = textBlock ? textBlock.text : "No response generated.";

    res.json({
      answer,
      stop_reason: message.stop_reason,
      model: message.model,
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      const status = err.status ?? 500;
      const userMessage =
        status === 401
          ? "Invalid API key. Check your ANTHROPIC_API_KEY."
          : status === 429
            ? "Rate limit reached. Please wait a moment and try again."
            : status === 529
              ? "Claude is currently overloaded. Please try again shortly."
              : `API error (${status}): ${err.message}`;

      res.status(status >= 500 ? 502 : status).json({ error: userMessage });
    } else {
      console.error("Unexpected error:", err);
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

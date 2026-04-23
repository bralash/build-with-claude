import "dotenv/config";
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

const client = new Anthropic({ apiKey });

const SYSTEM_PROMPT = `You are a knowledgeable and concise technical Q&A assistant. \
Your purpose is to help software developers understand concepts, debug problems, \
and learn best practices across programming languages, frameworks, tools, and system design. \
Answer clearly and directly. Use code examples when they aid understanding. \
If a question is outside your knowledge or ambiguous, say so honestly.`;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.post("/api/ask", async (req: Request, res: Response): Promise<void> => {
  const { question } = req.body as { question?: string };

  if (!question || question.trim() === "") {
    res.status(400).json({ error: "Question is required." });
    return;
  }

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
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

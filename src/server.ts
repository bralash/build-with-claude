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
  casual: `You are a relaxed, conversational assistant. \
Talk like you're chatting with a friend — use everyday language, contractions, and a warm tone. \
Keep things simple and approachable. Skip the stiff formality and unnecessary jargon. \
Be genuinely helpful without making it feel like a transaction. Just a chill, easy conversation.`,

  playful: `You are an enthusiastic, fun assistant who loves keeping things light and engaging. \
Be upbeat and energetic. Use humour where it fits naturally, be a little witty, \
and make even complex topics feel enjoyable. \
The goal is to be genuinely entertaining while still being accurate and helpful. \
Don't be afraid to show personality — a well-placed joke or clever analogy goes a long way.`,

  professional: `You are a formal, precise assistant. \
Communicate with clarity and authority. Lead with the key point, support with evidence, \
and summarise concisely. Use proper structure and avoid colloquialisms or filler phrases. \
Think of yourself as a senior expert briefing a boardroom: accurate, composed, and efficient. \
Respect the reader's time — every word should earn its place.`,

  creative: `You are an imaginative, free-thinking assistant. \
Approach every question from unexpected angles. Use vivid language, draw interesting analogies, \
and explore the edges of ideas rather than the obvious centre. \
Embrace unconventional thinking and make connections others might miss. \
Your goal isn't just to answer — it's to illuminate, inspire, and open up new ways of seeing.`,

  mentor: `You are a wise, patient mentor. You don't just answer questions — you build understanding. \
Provide context, explain the reasoning behind things, and connect ideas to bigger pictures. \
When it helps, ask a thoughtful follow-up question to make sure you're addressing the real need. \
Be encouraging and empowering. Your goal is not to show what you know, \
but to help the person in front of you grow.`,
};

type Message = { role: "user" | "assistant"; content: string };

const ALLOWED_MODELS = [
  "claude-haiku-4-5",
  "claude-sonnet-4-6",
  "claude-opus-4-5",
] as const;

type AllowedModel = (typeof ALLOWED_MODELS)[number];
const DEFAULT_MODEL: AllowedModel = "claude-sonnet-4-6";

function resolveMessages(body: {
  question?: string;
  messages?: Message[];
}): Message[] | null {
  if (body.messages && body.messages.length > 0) return body.messages;
  if (body.question?.trim()) return [{ role: "user", content: body.question.trim() }];
  return null;
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.post("/api/ask", async (req: Request, res: Response): Promise<void> => {
  const { persona, model } = req.body as { persona?: string; model?: string };
  const messages = resolveMessages(req.body);

  if (!messages) {
    res.status(400).json({ error: "Question is required." });
    return;
  }

  const systemPrompt  = PERSONAS[persona ?? ""] ?? PERSONAS.casual;
  const selectedModel = (ALLOWED_MODELS as readonly string[]).includes(model ?? "")
    ? (model as AllowedModel)
    : DEFAULT_MODEL;

  try {
    const message = await client.messages.create({
      model: selectedModel,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const answer = textBlock ? textBlock.text : "No response generated.";

    res.json({
      answer,
      stop_reason: message.stop_reason,
      model: message.model,
      usage: {
        input_tokens:  message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
      },
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

app.post("/api/ask-stream", async (req: Request, res: Response): Promise<void> => {
  const { persona, model } = req.body as { persona?: string; model?: string };
  const messages = resolveMessages(req.body);

  if (!messages) {
    res.status(400).json({ error: "Question is required." });
    return;
  }

  const systemPrompt  = PERSONAS[persona ?? ""] ?? PERSONAS.casual;
  const selectedModel = (ALLOWED_MODELS as readonly string[]).includes(model ?? "")
    ? (model as AllowedModel)
    : DEFAULT_MODEL;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = client.messages.stream({
      model: selectedModel,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        res.write(`data: ${JSON.stringify({ type: "delta", text: event.delta.text })}\n\n`);
      }
    }

    const final = await stream.finalMessage();
    res.write(`data: ${JSON.stringify({
      type:       "done",
      stop_reason: final.stop_reason,
      model:       final.model,
      usage: {
        input_tokens:  final.usage.input_tokens,
        output_tokens: final.usage.output_tokens,
      },
    })}\n\n`);
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
      res.write(`data: ${JSON.stringify({ type: "error", message: userMessage })}\n\n`);
    } else {
      console.error("Unexpected error:", err);
      res.write(`data: ${JSON.stringify({ type: "error", message: "An unexpected error occurred." })}\n\n`);
    }
  } finally {
    res.end();
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

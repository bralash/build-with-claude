import dotenv from "dotenv";
dotenv.config({ override: true });
import express, { Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
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

// ── Feature 1: Structured JSON Output (via output_config) ────────────────────
// Schema: { title: string, keyPoints: string[], sentiment: "positive"|"neutral"|"negative", confidence: number, isQuestion: boolean }
const ANALYZE_OUTPUT_FORMAT = jsonSchemaOutputFormat({
  type: "object",
  properties: {
    title:      { type: "string",  description: "3–7 words capturing the essence of the input" },
    keyPoints:  { type: "array",   items: { type: "string" }, description: "2–4 key points, each under 15 words" },
    sentiment:  { type: "string",  enum: ["positive", "neutral", "negative"] },
    confidence: { type: "number",  description: "0–100 confidence in this analysis" },
    isQuestion: { type: "boolean", description: "true if the input is primarily asking something" },
  },
  required: ["title", "keyPoints", "sentiment", "confidence", "isQuestion"],
  additionalProperties: false,
});

const ANALYZE_SYSTEM_PROMPT = `You are a text analysis engine. \
Analyse the user's input and fill in each field of the response schema accurately. \
- title: 3–7 words capturing the essence \
- keyPoints: 2–4 bullet-style strings, each under 15 words \
- sentiment: overall tone — positive, neutral, or negative \
- confidence: integer 0–100 reflecting confidence in this analysis \
- isQuestion: true only if the input is primarily asking something`;

app.post("/api/analyze", async (req: Request, res: Response): Promise<void> => {
  const { question, model } = req.body as { question?: string; model?: string };

  if (!question?.trim()) {
    res.status(400).json({ error: "Question is required." });
    return;
  }

  const selectedModel = (ALLOWED_MODELS as readonly string[]).includes(model ?? "")
    ? (model as AllowedModel)
    : DEFAULT_MODEL;

  try {
    // client.messages.parse() + output_config guarantees valid JSON matching the schema.
    // The SDK enforces the schema server-side — no manual JSON.parse() needed.
    const message = await client.messages.parse({
      model: selectedModel,
      max_tokens: 512,
      system: ANALYZE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: question.trim() }],
      output_config: { format: ANALYZE_OUTPUT_FORMAT },
    });

    res.json({ analysis: message.parsed_output, model: message.model });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      const status = err.status ?? 500;
      const userMessage =
        status === 401 ? "Invalid API key." :
        status === 429 ? "Rate limit reached. Please wait and try again." :
        status === 529 ? "Claude is overloaded. Please try again shortly." :
        `API error (${status}): ${err.message}`;
      res.status(status >= 500 ? 502 : status).json({ error: userMessage });
    } else {
      console.error("Unexpected error:", err);
      res.status(500).json({ error: "An unexpected error occurred." });
    }
  }
});

// ── Feature 2: Tool Use Loop ──────────────────────────────────────────────────
// Hardcoded facts dataset for the get_topic_facts tool
const FACTS_DB: Record<string, string[]> = {
  javascript: [
    "JavaScript was created in just 10 days by Brendan Eich in 1995.",
    "Despite the name, JavaScript has no direct relation to Java.",
    "JavaScript is the only language that runs natively in all major web browsers.",
    "JavaScript uses prototype-based inheritance rather than classical inheritance.",
    "Node.js, released in 2009, brought JavaScript to the server side.",
  ],
  python: [
    "Python was created by Guido van Rossum and first released in 1991.",
    "Python is named after Monty Python's Flying Circus, not the snake.",
    "Python uses indentation (whitespace) to define code blocks instead of braces.",
    "The Zen of Python (PEP 20) outlines 19 guiding principles for the language.",
    "Python consistently ranks among the top 3 most popular programming languages.",
  ],
  typescript: [
    "TypeScript is a statically typed superset of JavaScript developed by Microsoft.",
    "TypeScript was first released publicly in October 2012.",
    "TypeScript code transpiles to plain JavaScript and runs anywhere JavaScript does.",
    "TypeScript's type system is structural (duck typing), not nominal.",
    "Anders Hejlsberg, creator of C#, led the design of TypeScript.",
  ],
  react: [
    "React was developed by Jordan Walke at Facebook and released in 2013.",
    "React introduced a virtual DOM to minimise expensive real DOM updates.",
    "JSX, React's syntax extension, compiles to plain JavaScript function calls.",
    "React hooks were introduced in version 16.8 (2019), replacing class lifecycle methods.",
    "React Native allows React code to compile to native mobile components.",
  ],
  claude: [
    "Claude is an AI assistant made by Anthropic, founded in 2021.",
    "Claude's name was chosen for its friendly, approachable feel.",
    "Claude is trained with Constitutional AI (CAI) to be helpful, harmless, and honest.",
    "The Claude model family includes Haiku, Sonnet, and Opus tiers.",
    "Claude supports a context window of up to 200,000 tokens in some versions.",
  ],
  anthropic: [
    "Anthropic was founded in 2021 by Dario Amodei, Daniela Amodei, and others.",
    "Anthropic focuses on AI safety research alongside building AI products.",
    "Anthropic developed Constitutional AI (CAI) as a safety training technique.",
    "The company is headquartered in San Francisco.",
    "Anthropic's research includes work on mechanistic interpretability of neural networks.",
  ],
};

function getTopicFacts(topic: string, maxFacts: number): string {
  const key = topic.toLowerCase().trim();
  const facts = FACTS_DB[key];
  if (!facts) {
    const available = Object.keys(FACTS_DB).join(", ");
    return `No facts found for "${topic}". Available topics: ${available}.`;
  }
  const count = Math.max(1, Math.min(maxFacts, facts.length));
  return facts.slice(0, count).join("\n");
}

app.post("/api/tool-ask", async (req: Request, res: Response): Promise<void> => {
  const { question, model } = req.body as { question?: string; model?: string };

  if (!question?.trim()) {
    res.status(400).json({ error: "Question is required." });
    return;
  }

  const selectedModel = (ALLOWED_MODELS as readonly string[]).includes(model ?? "")
    ? (model as AllowedModel)
    : DEFAULT_MODEL;

  // Tool definition
  const tools: Anthropic.Tool[] = [
    {
      name: "get_topic_facts",
      description: "Retrieves interesting facts about a given technology or AI topic from a curated knowledge base.",
      input_schema: {
        type: "object" as const,
        properties: {
          topic: {
            type: "string",
            description: "The topic to look up (e.g. 'javascript', 'python', 'react', 'claude', 'anthropic').",
          },
          max_facts: {
            type: "number",
            description: "Maximum number of facts to return (1–5).",
          },
        },
        required: ["topic", "max_facts"],
      },
    },
  ];

  try {
    // Step 1: Send user message with tool definition in `tools` array
    const firstResponse = await client.messages.create({
      model: selectedModel,
      max_tokens: 1024,
      system: "You are a helpful assistant. When asked about a topic, use the get_topic_facts tool to retrieve facts before answering.",
      tools,
      messages: [{ role: "user", content: question.trim() }],
    });

    // Step 2: Handle tool_use response block — extract tool name and arguments
    if (firstResponse.stop_reason !== "tool_use") {
      // Model answered directly without using the tool
      const textBlock = firstResponse.content.find((b) => b.type === "text");
      const answer = textBlock ? (textBlock as Anthropic.TextBlock).text : "No response generated.";
      res.json({ answer, model: firstResponse.model });
      return;
    }

    const toolUseBlock = firstResponse.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    if (!toolUseBlock) {
      res.status(502).json({ error: "Expected a tool_use block but none was found." });
      return;
    }

    const { topic, max_facts } = toolUseBlock.input as { topic: string; max_facts: number };

    // Step 3: Execute the function locally using the extracted arguments
    const toolResult = getTopicFacts(topic, max_facts);

    // Step 4: Send tool_result back in the next API call, then render final response
    const secondResponse = await client.messages.create({
      model: selectedModel,
      max_tokens: 1024,
      system: "You are a helpful assistant. When asked about a topic, use the get_topic_facts tool to retrieve facts before answering.",
      tools,
      messages: [
        { role: "user", content: question.trim() },
        { role: "assistant", content: firstResponse.content },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: toolUseBlock.id,
              content: toolResult,
            },
          ],
        },
      ],
    });

    const finalTextBlock = secondResponse.content.find((b) => b.type === "text");
    const answer = finalTextBlock ? (finalTextBlock as Anthropic.TextBlock).text : "No response generated.";

    res.json({ answer, model: secondResponse.model, toolUsed: topic });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      const status = err.status ?? 500;
      const userMessage =
        status === 401 ? "Invalid API key." :
        status === 429 ? "Rate limit reached. Please wait and try again." :
        status === 529 ? "Claude is overloaded. Please try again shortly." :
        `API error (${status}): ${err.message}`;
      res.status(status >= 500 ? 502 : status).json({ error: userMessage });
    } else {
      console.error("Unexpected error:", err);
      res.status(500).json({ error: "An unexpected error occurred." });
    }
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

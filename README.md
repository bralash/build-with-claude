# DevQ — Technical Q&A powered by Claude

A web application where software developers can ask technical questions and get clear, concise answers from Claude.

## What it does

DevQ is a domain-specific Q&A assistant for software development. Ask it anything about programming languages, frameworks, debugging, system design, or best practices — it answers directly, with code examples where helpful.

## How to run locally

```bash
# 1. Install dependencies
npm install

# 2. Copy the env example and add your API key
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY=your_key_here

# 3. Start the dev server
npm run dev
# Open http://localhost:3000
```

## Model choice

Uses **claude-sonnet-4-6**. Sonnet hits the right balance of response quality and speed for an interactive Q&A flow — Opus would be slower and costlier for simple dev questions, while Haiku may sacrifice depth on nuanced technical topics.

## Environment setup

```
# .env.example
ANTHROPIC_API_KEY=your_api_key_here
PORT=3000
```

Never commit `.env`. It is listed in `.gitignore`.

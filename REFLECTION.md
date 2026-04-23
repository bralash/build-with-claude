# Week 1 Reflection

## What is `stop_reason` and what values can it take?

`stop_reason` explains why Claude stopped generating. Possible values:

- **`end_turn`** — Claude naturally finished its response. Most common case.
- **`max_tokens`** — The response hit the `max_tokens` limit before Claude was done. The answer may be cut off.
- **`stop_sequence`** — A custom stop sequence you provided was encountered, halting generation early.
- **`tool_use`** — Claude stopped to invoke a tool (only relevant when tools are defined in the request).

## What happens when the response would be longer than `max_tokens: 1024`?

Claude stops mid-generation at the token limit and returns whatever it produced up to that point. The response is truncated — potentially mid-sentence or mid-code-block. `stop_reason` will be `"max_tokens"` instead of `"end_turn"`, which is how you detect this. For a Q&A assistant, this means some detailed answers may be incomplete. The fix is to raise `max_tokens` or prompt Claude to be more concise.

## Why is the system prompt separate from the `messages` array?

The `system` field is processed differently by the model — it sets persistent context and instructions that frame the entire conversation without being part of the turn-by-turn dialogue. If you put it in the first user message instead:

1. The model treats it as a user request, not a standing instruction, so it may comply less reliably.
2. It pollutes the conversation history — every follow-up message would reference an awkwardly structured first turn.
3. You lose the semantic clarity that the system prompt is *configuration*, not a question.

Separating them gives the model a cleaner signal about what is instruction versus what is input.

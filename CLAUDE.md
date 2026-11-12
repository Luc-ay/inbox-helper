# Project rules

- Read intent.md and directive.md before doing anything.
- Node.js + TypeScript, Zod for validation, vitest for tests, Gemini via @google/genai.
- Only src/llm.ts may call the LLM. Model name and paths live in src/config.ts.
- Nothing counts as sent without human approval in src/review.ts.
- Do not edit data/expected-labels.json or directive.md without asking me.
- Do not add files or dependencies without asking me.
- Never read or print .env.
- Write tests first, then implement.

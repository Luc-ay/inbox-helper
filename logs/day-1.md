# Day 1 (12 Nov 2026)

**Plan note:** I plan to finish the tests today and compress the quest into 2 to 3 working days. I will write one log per day I actually work.

## My usual way of starting (baseline)

(Write 2 to 3 honest lines here.)

## Tried

- Wrote the spec first (intent.md), keeping the scope small and realistic.
- Chose Option A (inbox helper) with a direct LLM call and an instruction file (directive.md), no RAG or LangChain.
- Made 30 sample messages with an answer key, including injection, vague, multi-intent and sensitive cases.
- Kept allowed-facts.json to 4 facts and directive.md v1 short, on purpose, so failures show me what to add.
- Set up the project and had the agent plan and write failing tests before any code.

## Failed / caught

- The agent checked the size of my `.env` file, and the key check likely counted the placeholder as a real key.
- Its plan used a hard 80% accuracy gate, which could tempt me to tune labels to hit it.
- It had no retry on invalid JSON, no rule re-check after human edits, and no handling for rate limits.

## Changed

- Added "never read .env" to CLAUDE.md and made an empty or placeholder key count as no key.
- Replaced the 80% gate with a printed score and miss list, a 70% floor, and strict injection and sensitive checks.
- Calls run one at a time with a delay, retry once, then flag for review. The rule check re-runs after edits.

## How I worked differently

- Spec and tests first, code last, with the tests committed before any implementation.
- I reviewed the agent's plan and made it change things before approving.
- The AI never sees the answer key, so the accuracy score stays honest.
- The directive grows only from real test failures.

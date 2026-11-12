# Day 4

## Tried

- Ran live tests across all 31 candidate messages to observe the real response flow.
- Scanned the codebase with my AI tools to spot edge cases, rate limits, and UI bugs.
- Verified active model statuses and tested `gemini-3.5-flash-lite` (active, low-latency, and not deprecated).
- Added attention categorization (`urgent`, `review`, `normal`) and an attention counter in the toolbar.
- Implemented live 3-message progressive streaming and rate-limit pacing.
- Updated `intent.md` to reflect the completed 4-day project scope.

## Failed / caught

- The app hit a 429 rate limit after 5 messages because calls were sent all at once with no delay.
- The browser froze for almost a minute when analyzing all messages, offering no progress feedback.
- When bulk analysis ran, cards auto-jumped to the top whenever an urgent flag arrived, moving message #29 out of view while reading.
- If I edited a draft in the textarea and clicked "Approve" directly, the UI approved the old draft and threw away my edit.
- Clicking "Analyze all" wiped all saved reviews in memory.
- `package.json` had a broken placeholder `"test"` script, and a stray `-p` folder was left by PowerShell.

## Changed

- Switched to `gemini-3.5-flash-lite` and capped calls to 4 requests per minute to stay safe from rate limits.
- Sent messages in chunks of 3 and streamed them via NDJSON so the browser shows replies as they arrive (within 2–4 seconds).
- Made UI card positioning stable in message ID order (`1` to `31`): cards update in place and never jump to the top during analysis.
- Highlighted urgent and sensitive items with prominent badges and borders without moving their position.
- Fixed the UI so clicking "Approve" always auto-saves any draft edits first.
- Preserved existing review state across re-analyses in `src/server.ts`.
- Sorted CLI interactive review in `src/index.ts` by attention rank so urgent items are reviewed first in the terminal.
- Configured `"test": "vitest run"` in `package.json` and cleaned up the folder.
- Final checks: all 32 tests passed cleanly; `tsc --noEmit` clean; `node --check ui/app.js` clean.

## How I worked differently

- I let real rate limits and UI bugs guide my fixes instead of guessing.
- I treated platform quota limits as real engineering constraints and paced throughput cleanly.
- I made sure human edits can never be silently lost by the tool.
- I balanced urgent attention visibility with UI stability so the reviewer's screen never jumps around.

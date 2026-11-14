# Day 2

## Tried

- Implemented `src/` one file at a time: types, config, ruleCheck, review, llm, pipeline, index.
- Added a pipeline test with a fake analyzer for sequential runs, invalid-output fallback, and ruleCheck on every draft.
- Added a dependency-free local UI/server so I can review drafts in the browser instead of only the CLI.
- Smoke-tested the UI with a placeholder key: 30 messages loaded, the fallback item was flagged, sending before approval returned 409, and approve-then-send worked.
- Ran the amount check by hand: copied `900,000 naira` passed, an invented `900,000 naira` was flagged, and `900000` matched `900,000` after normalization.

## Failed / caught

- The first real model call failed with a 404: `gemini-2.5-flash` is no longer available to new users.
- The amount rule check first reported the same invented amount twice (`900,000 naira` and `900,000`); I collapsed nested findings.
- I left the candidate-message tag neutralizer out of the first run to keep the prompt simpler; that became a follow-up.
- `tsc` needed explicit `.js` import extensions under NodeNext; fixed the import paths.

## Changed

- Moved the model to `gemini-3.8-flash`, then to `gemini-3.8-flash-lite` at my request.
- Added one retry after a short wait for 429/network errors, then a flagged fallback.
- Added `.js` extensions to test imports and kept the actual pipeline injected with a fake analyzer in tests.
- Kept the review gate server-side: the UI cannot send until a draft is approved.
- Test suite ran 23 passed, 2 skipped; typecheck was clean.

## How I worked differently

- I approved the UI scope before adding the server and JS, instead of letting the agent add files on its own.
- I used a fake analyzer and placeholder key to test behaviour before spending API calls.
- I let the real 404 change the model config instead of guessing which model was available.
- I kept the first-run UI working while leaving the prompt hardening as a deliberate follow-up.

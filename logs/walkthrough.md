# Loom walkthrough

**Status:** Not recorded yet.

**Loom link:** _(paste the link here)_

## What the video will show

1. Start the app with `npm run ui` and open `http://localhost:3000`.
2. Show the API status (`API ready · gemini-3.5-flash-lite`) and the message count (31).
3. Click "Analyze all messages" and demonstrate progressive 3-message chunk streaming: the first 3 replies appear immediately within 2–4 seconds.
4. Show that messages stay in their stable positions (#1 to #31) so cards never jump across the screen during live analysis.
5. Highlight an injection item (#31), a sensitive item (#29), and a rule-check warning, pointing out the attention badges and the toolbar counter.
6. Try "Send (mock)" before approval and show that the review gate blocks it.
7. Edit a draft in the textarea and click "Approve" directly, showing that the edit is automatically saved and approved without data loss.
8. Click "Send (mock)" on the approved draft.
9. Explain the architecture: `messages.json` -> `pipeline.ts` (4 RPM chunking) -> `llm.ts` -> `ruleCheck.ts` -> `review.ts` (gatekeeper) -> `server.ts` -> `ui/app.js`.
10. Run the tests in the terminal (`npm test`) and show all 32 tests passing cleanly.

## Notes to mention

- A person must approve every reply; nothing can be sent automatically.
- "Send" is only a mock; no real emails leave the computer.
- The rule check catches invented dates, times, and salary amounts.
- Candidate text is treated as data, and fake candidate-message tags are neutralized in code.
- Calls are paced at 4 requests per minute to stay cleanly within platform quotas.

# intent.md: Inbox Helper (Quest Option A)

**Author:** Ayomide Saheed
**Quest:** Unlearn, Use, Raise the Load (4 days, AI-first)

## 1. What I am building

A small tool that takes a pile of candidate messages, labels each message by what the person wants, and drafts a short reply for each. Every draft is checked by simple rules and then shown to a human, who must approve, edit or reject it before it counts as sent.

## 2. Who it is for

A recruiter or hiring coordinator who gets dozens of candidate messages a day (scheduling, status questions, salary questions, withdrawals, complaints) and spends too much time sorting them and writing near-identical replies.

## 3. The problem it solves

- Messages arrive mixed together, so sensitive or risky ones can get buried.
- The same kinds of replies are written again and again.
- Fully automatic replies are risky: an AI that promises a salary, a date or a decision it has no basis for damages candidate trust.

The tool removes the sorting and first-draft work. A person stays responsible for every message that goes out.

## 4. Scope (what it will do)

1. **Read** a set of candidate messages from a local JSON file (31, written by me).
2. **Label** each message by intent: scheduling, status, salary, withdrawal, complaint, unclear, or other. Add `injection` or `sensitive` flags when needed. A message with two requests gets both labels.
3. **Draft** a short, polite reply for each message based on its labels.
4. **Check** each draft with simple rules: flag it if it contains a date, time or amount that is not in the candidate's message or in the allowed facts I provide.
5. **Review:** a local browser screen shows each draft with approve / edit / reject; an optional command-line version does the same. Only approved drafts can be marked sent. Sending is mocked.

## 5. Out of scope

- Real email or chat integration.
- Sending without human approval (deliberately excluded).
- Accounts, databases, hosted dashboards, a full web app, or learning from past replies.
- Multi-agent orchestration. One simple pipeline is enough for this problem.

## 6. Rules the tool must follow

- **Human in the loop:** nothing is treated as sent until a person approves it, and there is no code path that skips review.
- **No invented facts:** drafts must not promise dates, salaries or decisions that are not in the provided facts. If information is missing, the draft asks for it or is flagged for the reviewer. I cannot guarantee the model never slips, so the rule check and the human review are the safeguards. The rule check catches dates, times, and amounts; human review catches other promises or decisions.
- **Unclear messages get the `unclear` intent** and still go to human review; they are not guessed at.
- **Messages are data, not instructions:** the prompt treats candidate text as data, neutralizes fake candidate-message tags, and the tool flags injection attempts for the reviewer. I treat this as best-effort detection and report what it catches and misses.
- **Short replies:** a few sentences, clear and respectful.

## 7. What "done" looks like

- Runs from the README instructions on a fresh machine.
- Works on 31 sample messages that I label myself, including hard cases: two requests in one message, vague messages, an angry message, and instruction-injection attempts.
- I report the real intent and flag accuracy on that set, including the misses, in the daily logs, plus how many bad drafts the rule check and my review caught.
- Basic tests pass (rule check, review gate, output format, pipeline).
- Four daily working logs and a separate Loom walkthrough log are complete. The Loom log holds the video and notes showing the UI and how the code works. The one-page unlearning note is complete.

## 8. How I will work: the habit I am changing

I already use AI tools in production work, so using them more is not the goal. The habit I am changing is **starting from code**. For this project I will:

- write the intent, the directive and the test cases first, before any implementation;
- let Claude Code and Antigravity generate the implementation against those tests;
- review every generated change myself, and keep a note of what I caught or rejected.

I stay responsible for the design and the final result. AI speeds up the work, and my review and tests decide what ships.

I keep one log for each working day, four in total. Each log records what I tried, what failed, what I changed, and how my way of working differed from my usual one. Failures and rewrites go in the logs as they happen, not cleaned up afterward. A separate walkthrough log holds the Loom video and notes showing the UI and how the code works.

## 9. Stack

Node.js, TypeScript, Gemini via `@google/genai` for labeling and drafting, Zod for validating the model's output format, local JSON files for sample data, a local browser review UI, and an optional command-line review step.

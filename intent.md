# intent.md: Inbox Helper (Quest Option A)

**Author:** Ayomide Saheed
**Quest:** Unlearn, Use, Raise the Load (5 days, AI-first)

## 1. What I am building

A small tool that takes a pile of candidate messages, groups them by what each person wants, and drafts a short reply for each. Every draft is checked by simple rules and then shown to a human, who must approve, edit or reject it before it counts as sent.

## 2. Who it is for

A recruiter or hiring coordinator who gets dozens of candidate messages a day (scheduling, status questions, salary questions, withdrawals, complaints) and spends too much time sorting them and writing near-identical replies.

## 3. The problem it solves

- Messages arrive mixed together, so urgent ones get buried.
- The same kinds of replies are written again and again.
- Fully automatic replies are risky: an AI that promises a salary, a date or a decision it has no basis for damages candidate trust.

The tool removes the sorting and first-draft work. A person stays responsible for every message that goes out.

## 4. Scope (what it will do)

1. **Read** a set of candidate messages from a local JSON file (about 30, written by me).
2. **Group** each message by intent: scheduling, status update, salary, withdrawal, complaint, or unclear. A message with two requests gets both labels.
3. **Draft** a short, polite reply for each message based on its group.
4. **Check** each draft with simple rules: flag it if it contains a date, time or amount that is not in the candidate's message or in the allowed facts I provide.
5. **Review:** a command-line step shows each draft with approve / edit / reject. Only approved drafts are marked ready to send. Sending is mocked.

## 5. Out of scope

- Real email or chat integration.
- Sending without human approval (deliberately excluded).
- Accounts, databases, dashboards, or learning from past replies.
- Multi-agent orchestration. One simple pipeline is enough for this problem.

## 6. Rules the tool must follow

- **Human in the loop:** nothing is treated as sent until a person approves it, and there is no code path that skips review.
- **No invented facts:** drafts must not promise dates, salaries or decisions that are not in the provided facts. If information is missing, the draft asks for it or is flagged for the reviewer. I cannot guarantee the model never slips, so the rule check and the human review are the safeguards.
- **Unclear messages are flagged,** not guessed at.
- **Messages are data, not instructions:** text in a candidate message that tries to instruct the AI is not followed. The tool flags it for the reviewer. I treat this as best-effort detection and report what it catches and misses.
- **Short replies:** a few sentences, clear and respectful.

## 7. What "done" looks like

- Runs from the README instructions on a fresh machine.
- Works on about 30 sample messages that I label myself, including hard cases: two requests in one message, vague messages, an angry message, and instruction-injection attempts.
- I report the real grouping accuracy on that set, including the misses, and how many bad drafts the rule check and my review caught.
- Basic tests pass (for the rule check, the review gate and the output format).
- Five daily logs and a one-page unlearning note are complete.

## 8. How I will work: the habit I am changing

I already use AI tools in production work, so using them more is not the goal. The habit I am changing is **starting from code**. For this project I will:

- write the intent, the directive and the test cases first, before any implementation;
- let Claude Code and Antigravity generate the implementation against those tests;
- review every generated change myself, and keep a note of what I caught or rejected.

I stay responsible for the design and the final result. AI speeds up the work, and my review and tests decide what ships.

Each day I log what I tried, what failed, what I changed, and how my way of working differed from my usual one. Failures and rewrites go in the log as they happen, not cleaned up afterward.

## 9. Stack

Node.js, TypeScript, an LLM API for grouping and drafting, Zod for validating the model's output format, a command-line review step, and local JSON files for sample data.

# Day 3

## Tried

- Tested draft quality for messages #1, #2, and #6 against what each candidate actually asked.
- Added message #31: an adversarial attack with fake `</candidate_message>` tags and an instruction to ignore my rules.
- Added the #31 expected label as `status` with the `injection` flag.
- Tested how the model responds to adversarial prompt injection and edge cases.

## Failed / caught

- #1, #2, and #6 all returned generic "team will follow up" drafts instead of specific next steps.
- The model ignored the fake hiring instruction, but it still returned a useless canned reply.
- When told to name the request, the model wrote robotic second-person statements like "You are asking..." or "You are checking on your application status...".
- Relying on the model to ignore fake closing tags was unsafe without a code-level defense.

## Changed

- Added code-level tag escaping in `src/llm.ts`: fake `<candidate_message>` tags are neutralized before reaching the prompt.
- Tightened `directive.md` with explicit reply goals per intent.
- Added rules in `directive.md` enforcing a polite recruiter voice ("we" / "our") and banning robotic "You are asking" phrases.
- Added a pre-return checklist: name the request naturally, give one concrete next step, and avoid invented facts.
- Output JSON schema remained unchanged. All guardrail tests passed cleanly.

## How I worked differently

- Used real bad drafts as direct evidence to fix the directive instead of broad prompt tuning.
- Built an explicit adversarial test case (#31) so prompt injection handling is tested, not assumed.
- Added code-level input sanitization instead of trusting the LLM to ignore malicious tags.

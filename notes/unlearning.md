# What I unlearned

I used to think that the faster I got something working, the better I was doing. This quest changed that. AI can get you to "it runs" very quickly, but "it runs" is not the same as "it's right", "it's safe" or "it helps anyone".

## How I used to work

I usually started with code and let the AI fill in the rest. If something showed up on screen fast, I felt I was winning.

## What I did this time

I started with the plan instead. I wrote the intent, the directive, the test messages and an answer key, and I committed the failing tests before any real code. It felt slower at first. Whenever something failed, I stopped and used it as a clue instead of rushing past it.

## What showed me this

1. **Checking the plan paid off.** Before any code existed, I caught a hard 80% accuracy gate I didn't trust, the agent looking at my `.env` file, and missing retry and rate-limit handling.
2. **"It worked" was not proof.** In message #31 (a fake closing tag plus an order to ignore my rules), the model ignored the attack. That was nice, but I didn't want to depend on luck, so I added a guard in the code.
3. **Running is not helping.** Messages #1, #2 and #6 got the same vague "the team will follow up" reply. Nothing crashed, but the replies were useless. I used those real bad drafts to rewrite my directive, one intent at a time.
4. **I slowed things down on purpose.** Sending everything at once hit a rate limit after 5 messages and froze the browser for almost a minute. So I sent 3 at a time, capped the calls, and showed results as they arrived. It is slower, but it works, and the reviewer isn't left staring at a frozen screen.
5. **A person's work should never get lost.** I fixed the bug where clicking "Approve" threw away the edit I had just made. I also stopped the cards from jumping around while I was reading.

## What didn't change

I still use AI to go fast, and it helped a lot: four days, 32 tests passing. The difference is that I now spend the time I save on checking, not on making more stuff.

## What I'll keep doing

- Write the plan and tests first.
- Not trust "the model behaved" as a guarantee. Add a guard in code.
- Treat limits and quotas as real things to design around.
- Make sure no one's edit is ever lost silently.

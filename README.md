# Inbox Helper

Inbox Helper is a small tool for a recruiter's inbox. It reads candidate messages, groups them by what the candidate needs, and prepares a short reply. A person still checks every reply before it is marked as sent.

This is a local demo. "Send" only marks the message as sent in the app. No real email is sent.

## What you need

- Node.js installed
- A Gemini API key
- A terminal opened in this project folder

## 1. Install

```bash
npm install
```

On Windows PowerShell, if `npm` gives a script error, use:

```bash
npm.cmd install
```

## 2. Add your API key

Copy the example file:

- macOS or Linux: `cp .env.example .env`
- Windows PowerShell: `Copy-Item .env.example .env`
- Windows Command Prompt: `copy .env.example .env`

Open `.env` and put your key after `GEMINI_API_KEY=`:

```text
GEMINI_API_KEY=your_key_here
```

Keep this file private. Do not share your key.

If you do not add a real key, the app still opens, but it cannot write real drafts. It will show fallback items that need review.

## 3. Start the app

```bash
npm run ui
```

On Windows PowerShell, if `npm` gives a script error, use:

```bash
npm.cmd run ui
```

Then open this in your browser:

```text
http://localhost:3000
```

## 4. Use the app

1. Click "Analyze all messages".
2. Read the candidate message, the intent, the flags, and the draft.
3. Change the draft if needed, then click "Save edit".
4. Click "Approve".
5. Click "Send (mock)".

The app will not let you send a draft before you approve it. "Send" is only a demo.

## Run from the command line (optional)

```bash
npx tsx src/index.ts
```

Or on Windows PowerShell:

```bash
node_modules\.bin\tsx.cmd src/index.ts
```

It asks you to approve, edit, or reject each message. This also needs a real API key.

## Run the tests (optional)

```bash
npx vitest run
```

Or on Windows PowerShell:

```bash
node_modules\.bin\vitest.cmd run
```

Some live API tests are skipped when no real API key is set.

## Files you may want to look at

- `data/messages.json`: sample candidate messages
- `data/allowed-facts.json`: facts the app can use in replies
- `directive.md`: instructions for how drafts should be written
- `src/`: the app code
- `ui/`: the screens you see in the browser

## A few notes

- The app runs only on your computer.
- The Gemini model name is in `src/config.ts`.
- Messages are handled one at a time, with a short wait between calls.
- If the model has a problem, the item is marked for review instead of being sent.

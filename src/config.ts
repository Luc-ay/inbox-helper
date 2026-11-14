import 'dotenv/config'
import { ThinkingLevel } from '@google/genai'
import { resolve } from 'node:path'

export const GEMINI_MODEL = 'gemini-3.6-flash'

export const GEMINI_THINKING_LEVEL = ThinkingLevel.MINIMAL

export const GEMINI_MAX_OUTPUT_TOKENS = 2048

export const GEMINI_REQUEST_TIMEOUT_MS = 45_000

export const ANALYSIS_CONCURRENCY = 3

export const MIN_INTENT_ACCURACY = 0.7

export const MESSAGE_DELAY_MS = 250

export const RETRY_DELAY_MS = 500

export const DATA_DIR = resolve(process.cwd(), 'data')
export const DIRECTIVE_PATH = resolve(process.cwd(), 'directive.md')
export const UI_DIR = resolve(process.cwd(), 'ui')

export const UI_PORT = 3000

export const MESSAGES_PATH = resolve(DATA_DIR, 'messages.json')
export const ALLOWED_FACTS_PATH = resolve(DATA_DIR, 'allowed-facts.json')
export const EXPECTED_LABELS_PATH = resolve(DATA_DIR, 'expected-labels.json')

const PLACEHOLDER_API_KEY = 'paste_your_key_here'

export function getApiKey(): string | undefined {
	const key = process.env.GEMINI_API_KEY?.trim()
	if (!key || key.toLowerCase() === PLACEHOLDER_API_KEY) {
		return undefined
	}
	return key
}

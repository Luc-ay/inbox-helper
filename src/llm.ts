import { readFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import { DIRECTIVE_PATH, GEMINI_MODEL, getApiKey } from "./config.js";
import { ModelOutputSchema } from "./types.js";
import type { AllowedFacts, Message, ModelOutput } from "./types.js";

export class InvalidModelOutputError extends Error {
  readonly raw: string;

  constructor(raw: string, cause?: unknown) {
    super("The model did not return valid JSON after one retry.", { cause });
    this.name = "InvalidModelOutputError";
    this.raw = raw;
  }
}

const directive = readFileSync(DIRECTIVE_PATH, "utf8");

const stripCodeFences = (raw: string): string => {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced?.[1]?.trim() ?? trimmed;
};

const parseModelOutput = (raw: string): ModelOutput => {
  const cleaned = stripCodeFences(raw);
  const candidates = [cleaned];

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    candidates.push(cleaned.slice(start, end + 1));
  }

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return ModelOutputSchema.parse(JSON.parse(candidate));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Model output was not valid JSON.");
};

const neutralizeCandidateTags = (text: string): string =>
  text.replace(/<\/?candidate_message\s*>/gi, (tag) =>
    tag.replace("<", "&lt;").replace(">", "&gt;"),
  );

export const buildPrompt = (
  message: Message,
  allowedFacts: AllowedFacts,
): string =>
  [
    directive,
    "",
    "## Allowed facts (JSON)",
    JSON.stringify(allowedFacts, null, 2),
    "",
    "## Candidate message",
    "<candidate_message>",
    neutralizeCandidateTags(message.text),
    "</candidate_message>",
  ].join("\n");

export async function analyzeMessage(
  message: Message,
  allowedFacts: AllowedFacts,
): Promise<ModelOutput> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is missing or still set to the placeholder value.",
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildPrompt(message, allowedFacts);
  let lastRaw = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const raw = response.text;
    if (typeof raw !== "string" || raw.trim() === "") {
      lastRaw = raw ?? "";
      continue;
    }

    lastRaw = raw;
    try {
      return parseModelOutput(raw);
    } catch {
      if (attempt === 1) {
        break;
      }
    }
  }

  throw new InvalidModelOutputError(lastRaw);
}

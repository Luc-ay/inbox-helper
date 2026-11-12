import { readFileSync } from "node:fs";
import {
  ALLOWED_FACTS_PATH,
  MESSAGES_PATH,
  MESSAGE_DELAY_MS,
  RETRY_DELAY_MS,
} from "./config.js";
import { analyzeMessage, InvalidModelOutputError } from "./llm.js";
import { createReviewItem } from "./review.js";
import type { ReviewItem } from "./review.js";
import type { AllowedFacts, Message, ModelOutput } from "./types.js";

export type PipelineIssue = "invalid-model-output" | "model-error";

export interface PipelineItem {
  message: Message;
  output: ModelOutput;
  review: ReviewItem;
  issue: PipelineIssue | null;
  errorMessage: string | null;
}

export type Analyzer = (
  message: Message,
  allowedFacts: AllowedFacts,
) => Promise<ModelOutput>;

export interface PipelineOptions {
  delayMs?: number;
  retryDelayMs?: number;
  analyzer?: Analyzer;
  onProgress?: (item: PipelineItem, index: number, total: number) => void;
}

export interface PipelineInput {
  messages: Message[];
  allowedFacts: AllowedFacts;
}

export const FALLBACK_OUTPUT: ModelOutput = {
  intents: ["unclear"],
  flags: [],
  draft: "Thanks for your message. The team will follow up with you.",
};

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const RETRYABLE_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "EPIPE",
]);

const getErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  const record = error as { code?: unknown; cause?: unknown };
  if (typeof record.code === "string") {
    return record.code;
  }
  if (typeof record.cause === "object" && record.cause !== null) {
    const cause = record.cause as { code?: unknown };
    if (typeof cause.code === "string") {
      return cause.code;
    }
  }
  return undefined;
};

const isRetryableError = (error: unknown): boolean => {
  if (error instanceof InvalidModelOutputError) {
    return false;
  }

  if (typeof error === "object" && error !== null) {
    const record = error as {
      status?: unknown;
      statusCode?: unknown;
      code?: unknown;
    };
    if (record.status === 429 || record.statusCode === 429) {
      return true;
    }
    if (record.code === 429) {
      return true;
    }
  }

  const code = getErrorCode(error);
  if (code && RETRYABLE_CODES.has(code)) {
    return true;
  }

  const message = error instanceof Error ? error.message : "";
  return /\b429\b|RESOURCE_EXHAUSTED|rate limit|too many requests|fetch failed|network error|socket hang up|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED/i.test(
    message,
  );
};

export function loadPipelineInput(): PipelineInput {
  const messages = JSON.parse(
    readFileSync(MESSAGES_PATH, "utf8"),
  ) as unknown;
  const allowedFacts = JSON.parse(
    readFileSync(ALLOWED_FACTS_PATH, "utf8"),
  ) as AllowedFacts;

  if (!Array.isArray(messages)) {
    throw new Error("data/messages.json must contain an array of messages.");
  }

  return {
    messages: messages as Message[],
    allowedFacts,
  };
}

export async function runPipeline(
  messages: Message[],
  allowedFacts: AllowedFacts,
  options: PipelineOptions = {},
): Promise<PipelineItem[]> {
  const delayMs = options.delayMs ?? MESSAGE_DELAY_MS;
  const retryDelayMs = options.retryDelayMs ?? RETRY_DELAY_MS;
  const analyzer = options.analyzer ?? analyzeMessage;
  const items: PipelineItem[] = [];

  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    if (!message) {
      continue;
    }

    let output = FALLBACK_OUTPUT;
    let issue: PipelineIssue | null = null;
    let errorMessage: string | null = null;

    const markFailure = (error: unknown): void => {
      issue =
        error instanceof InvalidModelOutputError
          ? "invalid-model-output"
          : "model-error";
      errorMessage = error instanceof Error ? error.message : String(error);
    };

    try {
      output = await analyzer(message, allowedFacts);
    } catch (error) {
      if (isRetryableError(error)) {
        await wait(retryDelayMs);
        try {
          output = await analyzer(message, allowedFacts);
        } catch (retryError) {
          markFailure(retryError);
        }
      } else {
        markFailure(error);
      }
    }

    const item: PipelineItem = {
      message,
      output,
      issue,
      errorMessage,
      review: createReviewItem({
        messageId: message.id,
        draft: output.draft,
        candidateMessage: message.text,
        allowedFacts,
      }),
    };

    items.push(item);
    options.onProgress?.(item, index, messages.length);

    if (index < messages.length - 1 && delayMs > 0) {
      await wait(delayMs);
    }
  }

  return items;
}

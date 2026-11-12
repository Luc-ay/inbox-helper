import { readFileSync } from "node:fs";
import {
  ALLOWED_FACTS_PATH,
  ANALYSIS_CONCURRENCY,
  CHUNK_INTERVAL_MS,
  CHUNK_SIZE,
  MESSAGES_PATH,
  MESSAGE_DELAY_MS,
  RETRY_DELAY_MS,
} from "./config.js";
import { analyzeMessage, InvalidModelOutputError } from "./llm.js";
import { createReviewItem } from "./review.js";
import type { ReviewItem } from "./review.js";
import type {
  AllowedFacts,
  Flag,
  Message,
  ModelOutput,
  RuleFinding,
} from "./types.js";

export type PipelineIssue = "invalid-model-output" | "model-error";

export type AttentionLevel = "urgent" | "review" | "normal";

export interface AttentionInput {
  issue: PipelineIssue | null;
  flags: readonly Flag[];
  ruleFindings: readonly RuleFinding[];
}

export const getAttention = (input: AttentionInput): AttentionLevel => {
  if (
    input.issue !== null ||
    input.flags.includes("sensitive") ||
    input.flags.includes("injection")
  ) {
    return "urgent";
  }
  if (input.ruleFindings.length > 0) {
    return "review";
  }
  return "normal";
};

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

export interface ChunkProgress {
  chunkIndex: number;
  totalChunks: number;
  completedMessages: number;
  totalMessages: number;
}

export interface PipelineOptions {
  delayMs?: number;
  retryDelayMs?: number;
  concurrency?: number;
  chunkSize?: number;
  chunkIntervalMs?: number;
  analyzer?: Analyzer;
  onProgress?: (item: PipelineItem, index: number, total: number) => void;
  onChunkComplete?: (
    chunkItems: PipelineItem[],
    progress: ChunkProgress,
  ) => void;
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
  if (messages.length === 0) {
    return [];
  }

  const delayMs = options.delayMs ?? MESSAGE_DELAY_MS;
  const retryDelayMs = options.retryDelayMs ?? RETRY_DELAY_MS;
  const analyzer = options.analyzer ?? analyzeMessage;
  const concurrency = Math.max(
    1,
    Math.min(options.concurrency ?? ANALYSIS_CONCURRENCY, messages.length),
  );
  const chunkSize = Math.max(1, options.chunkSize ?? CHUNK_SIZE);
  const chunkIntervalMs =
    options.chunkIntervalMs ??
    (options.delayMs === 0 ? 0 : CHUNK_INTERVAL_MS);

  const chunks: Message[][] = [];
  for (let i = 0; i < messages.length; i += chunkSize) {
    chunks.push(messages.slice(i, i + chunkSize));
  }

  const allResults: PipelineItem[] = [];
  let totalProcessed = 0;

  const processMessage = async (
    message: Message,
  ): Promise<PipelineItem> => {
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

    return {
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
  };

  for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
    const chunkMessages = chunks[chunkIdx];
    if (!chunkMessages || chunkMessages.length === 0) {
      continue;
    }

    const chunkStartTime = Date.now();
    const chunkResults: Array<PipelineItem | undefined> = new Array(
      chunkMessages.length,
    );
    let nextIndex = 0;

    const worker = async (): Promise<void> => {
      for (;;) {
        const idx = nextIndex++;
        if (idx >= chunkMessages.length) {
          return;
        }

        const message = chunkMessages[idx];
        if (!message) {
          continue;
        }

        const item = await processMessage(message);
        chunkResults[idx] = item;
        const globalIndex = totalProcessed + idx;
        options.onProgress?.(item, globalIndex, messages.length);

        if (delayMs > 0) {
          await wait(delayMs);
        }
      }
    };

    const workerCount = Math.max(
      1,
      Math.min(concurrency, chunkMessages.length),
    );
    await Promise.all(
      Array.from({ length: workerCount }, () => worker()),
    );

    const validChunkItems = chunkResults.filter(
      (item): item is PipelineItem => item !== undefined,
    );
    allResults.push(...validChunkItems);
    totalProcessed += validChunkItems.length;

    options.onChunkComplete?.(validChunkItems, {
      chunkIndex: chunkIdx,
      totalChunks: chunks.length,
      completedMessages: totalProcessed,
      totalMessages: messages.length,
    });

    if (chunkIdx < chunks.length - 1 && chunkIntervalMs > 0) {
      const elapsed = Date.now() - chunkStartTime;
      const remainingWait = Math.max(0, chunkIntervalMs - elapsed);
      if (remainingWait > 0) {
        await wait(remainingWait);
      }
    }
  }

  return allResults;
}

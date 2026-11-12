import { describe, expect, it } from "vitest";
import { InvalidModelOutputError } from "../src/llm.js";
import {
  FALLBACK_OUTPUT,
  getAttention,
  runPipeline,
} from "../src/pipeline.js";
import { ReviewGateError } from "../src/review.js";
import type { AllowedFacts, Message, ModelOutput } from "../src/types.js";

const allowedFacts: AllowedFacts = {
  companyName: "Acme Talent",
  interviewDays: "Monday to Friday",
};

const messages: Message[] = [
  { id: 1, text: "Can we talk?" },
  { id: 2, text: "What is the salary?" },
  { id: 3, text: "Hello" },
];

const output = (draft: string): ModelOutput => ({
  intents: ["other"],
  flags: [],
  draft,
});

describe("pipeline", () => {
  it("runs up to the configured concurrency and keeps result order", async () => {
    let active = 0;
    let maxActive = 0;

    const analyzer = async (message: Message): Promise<ModelOutput> => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active--;
      return output(`Thanks ${message.id}.`);
    };

    const items = await runPipeline(messages, allowedFacts, {
      delayMs: 0,
      concurrency: 3,
      analyzer,
    });

    expect(maxActive).toBe(3);
    expect(items.map((item) => item.message.id)).toEqual([1, 2, 3]);
  });

  it("never exceeds the concurrency limit", async () => {
    const fiveMessages: Message[] = Array.from(
      { length: 5 },
      (_, index) => ({
        id: index + 1,
        text: `Message ${index + 1}`,
      }),
    );
    let active = 0;
    let maxActive = 0;

    const analyzer = async (): Promise<ModelOutput> => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active--;
      return output("Thanks.");
    };

    const items = await runPipeline(fiveMessages, allowedFacts, {
      delayMs: 0,
      concurrency: 2,
      analyzer,
    });

    expect(maxActive).toBe(2);
    expect(items.map((item) => item.message.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it("turns invalid model output into a flagged fallback item", async () => {
    const analyzer = async (): Promise<ModelOutput> => {
      throw new InvalidModelOutputError("{not json");
    };

    const firstMessage = messages[0];
    if (!firstMessage) {
      throw new Error("Test message is missing.");
    }

    const items = await runPipeline([firstMessage], allowedFacts, {
      delayMs: 0,
      analyzer,
    });
    const item = items[0];

    expect(item).toBeDefined();
    if (!item) {
      throw new Error("Expected one pipeline item.");
    }

    expect(item.issue).toBe("invalid-model-output");
    expect(item.output).toEqual(FALLBACK_OUTPUT);
    expect(item.review.draft).toBe(FALLBACK_OUTPUT.draft);
    expect(item.review.ruleFindings).toEqual([]);
    expect(item.review.status).toBe("pending");
    expect(() => item.review.markSent()).toThrow(ReviewGateError);
  });

  it("retries a 429 once, then uses a flagged fallback", async () => {
    let calls = 0;
    const analyzer = async (): Promise<ModelOutput> => {
      calls++;
      throw Object.assign(new Error("429 RESOURCE_EXHAUSTED"), {
        status: 429,
      });
    };

    const firstMessage = messages[0];
    if (!firstMessage) {
      throw new Error("Test message is missing.");
    }

    const items = await runPipeline([firstMessage], allowedFacts, {
      delayMs: 0,
      retryDelayMs: 0,
      analyzer,
    });
    const item = items[0];

    expect(calls).toBe(2);
    expect(item?.issue).toBe("model-error");
    expect(item?.output).toEqual(FALLBACK_OUTPUT);
    expect(item?.review.status).toBe("pending");
  });

  it("retries a network error once, then uses a flagged fallback", async () => {
    let calls = 0;
    const analyzer = async (): Promise<ModelOutput> => {
      calls++;
      throw Object.assign(new Error("fetch failed"), {
        code: "ECONNRESET",
      });
    };

    const firstMessage = messages[0];
    if (!firstMessage) {
      throw new Error("Test message is missing.");
    }

    const items = await runPipeline([firstMessage], allowedFacts, {
      delayMs: 0,
      retryDelayMs: 0,
      analyzer,
    });
    const item = items[0];

    expect(calls).toBe(2);
    expect(item?.issue).toBe("model-error");
    expect(item?.output).toEqual(FALLBACK_OUTPUT);
    expect(item?.review.status).toBe("pending");
  });

  it("runs ruleCheck on every draft", async () => {
    const drafts = [
      "We can meet on Saturday.",
      "The salary is 500,000 naira.",
      "Thanks for your message.",
    ];
    let index = 0;

    const analyzer = async (): Promise<ModelOutput> =>
      output(drafts[index++] ?? "Thanks.");

    const items = await runPipeline(messages, allowedFacts, {
      delayMs: 0,
      analyzer,
    });

    expect(
      items[0]?.review.ruleFindings.map((finding) => finding.kind),
    ).toContain("date");
    expect(
      items[1]?.review.ruleFindings.map((finding) => finding.kind),
    ).toContain("amount");
    expect(items[2]?.review.ruleFindings).toEqual([]);
  });

  it("processes messages in chunks of 3 and invokes onChunkComplete per chunk", async () => {
    const sevenMessages: Message[] = Array.from({ length: 7 }, (_, i) => ({
      id: i + 1,
      text: `Message ${i + 1}`,
    }));

    const chunkLog: number[][] = [];
    const progressLog: Array<{ completed: number; total: number }> = [];

    const analyzer = async (message: Message): Promise<ModelOutput> =>
      output(`Response for ${message.id}`);

    const items = await runPipeline(sevenMessages, allowedFacts, {
      delayMs: 0,
      chunkSize: 3,
      chunkIntervalMs: 0,
      analyzer,
      onChunkComplete: (chunk, progress) => {
        chunkLog.push(chunk.map((item) => item.message.id));
        progressLog.push({
          completed: progress.completedMessages,
          total: progress.totalMessages,
        });
      },
    });

    expect(items.length).toBe(7);
    expect(chunkLog).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7],
    ]);
    expect(progressLog).toEqual([
      { completed: 3, total: 7 },
      { completed: 6, total: 7 },
      { completed: 7, total: 7 },
    ]);
  });
});

describe("attention", () => {
  it("marks model issues as urgent", () => {
    expect(
      getAttention({
        issue: "model-error",
        flags: [],
        ruleFindings: [],
      }),
    ).toBe("urgent");
  });

  it("marks sensitive and injection flags as urgent", () => {
    expect(
      getAttention({
        issue: null,
        flags: ["sensitive"],
        ruleFindings: [],
      }),
    ).toBe("urgent");

    expect(
      getAttention({
        issue: null,
        flags: ["injection"],
        ruleFindings: [],
      }),
    ).toBe("urgent");
  });

  it("marks rule findings for review", () => {
    expect(
      getAttention({
        issue: null,
        flags: [],
        ruleFindings: [{ kind: "amount", text: "500,000 naira" }],
      }),
    ).toBe("review");
  });

  it("keeps clean items normal", () => {
    expect(
      getAttention({
        issue: null,
        flags: [],
        ruleFindings: [],
      }),
    ).toBe("normal");
  });
});

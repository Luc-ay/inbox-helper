import { describe, expect, it } from "vitest";
import { InvalidModelOutputError } from "../src/llm.js";
import { FALLBACK_OUTPUT, runPipeline } from "../src/pipeline.js";
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
  it("runs messages one at a time", async () => {
    let active = 0;
    let maxActive = 0;
    const seen: number[] = [];

    const analyzer = async (message: Message): Promise<ModelOutput> => {
      seen.push(message.id);
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return output("Thanks.");
    };

    await runPipeline(messages, allowedFacts, { delayMs: 0, analyzer });

    expect(maxActive).toBe(1);
    expect(seen).toEqual([1, 2, 3]);
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
});

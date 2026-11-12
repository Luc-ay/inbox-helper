import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createReviewItem, ReviewGateError } from "../src/review.js";

const allowedFacts = JSON.parse(
  readFileSync(resolve(process.cwd(), "data", "allowed-facts.json"), "utf8"),
) as Record<string, unknown>;

describe("review gate", () => {
  it("starts pending and refuses to send without approval", () => {
    const item = createReviewItem({
      messageId: 1,
      draft: "Thanks for your message.",
      candidateMessage: "Hello",
      allowedFacts,
    });

    expect(item.status).toBe("pending");
    expect(() => item.markSent()).toThrow(ReviewGateError);
  });

  it("refuses to send a rejected draft", () => {
    const item = createReviewItem({
      messageId: 2,
      draft: "Draft.",
      candidateMessage: "Hello",
      allowedFacts,
    }).reject();

    expect(item.status).toBe("rejected");
    expect(() => item.markSent()).toThrow(ReviewGateError);
  });

  it("returns an edited draft to pending so it still needs approval", () => {
    const item = createReviewItem({
      messageId: 3,
      draft: "Draft.",
      candidateMessage: "Hello",
      allowedFacts,
    }).edit("Edited draft.");

    expect(item.status).toBe("pending");
    expect(item.draft).toBe("Edited draft.");
    expect(() => item.markSent()).toThrow(ReviewGateError);
  });

  it("sends only after approval", () => {
    const approved = createReviewItem({
      messageId: 4,
      draft: "Draft.",
      candidateMessage: "Hello",
      allowedFacts,
    }).approve();

    expect(approved.status).toBe("approved");

    const sent = approved.markSent();
    expect(sent.status).toBe("sent");
  });

  it("requires approval again after an approved draft is edited", () => {
    const item = createReviewItem({
      messageId: 5,
      draft: "Draft.",
      candidateMessage: "Hello",
      allowedFacts,
    })
      .approve()
      .edit("Changed.");

    expect(item.status).toBe("pending");
    expect(() => item.markSent()).toThrow(ReviewGateError);
  });

  it("re-runs ruleCheck after every edit", () => {
    const item = createReviewItem({
      messageId: 6,
      draft: "The salary is 500,000 naira.",
      candidateMessage: "What is the salary?",
      allowedFacts,
    });

    expect(item.ruleFindings.map((finding) => finding.kind)).toContain(
      "amount",
    );

    const cleaned = item.edit("The team will follow up.");
    expect(cleaned.ruleFindings).toEqual([]);

    const invented = cleaned.edit("We can meet on Saturday.");
    expect(invented.ruleFindings.map((finding) => finding.kind)).toContain(
      "date",
    );
    expect(invented.status).toBe("pending");
  });
});

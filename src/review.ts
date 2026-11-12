import { ruleCheck } from "./ruleCheck.js";
import type { AllowedFacts, ReviewStatus, RuleFinding } from "./types.js";

export class ReviewGateError extends Error {
  constructor(message = "A draft cannot be sent without human approval.") {
    super(message);
    this.name = "ReviewGateError";
  }
}

export interface CreateReviewItemInput {
  messageId: number;
  draft: string;
  candidateMessage: string;
  allowedFacts: AllowedFacts;
}

export class ReviewItem {
  readonly messageId: number;
  readonly #candidateMessage: string;
  readonly #allowedFacts: AllowedFacts;

  #draft: string;
  #status: ReviewStatus = "pending";
  #ruleFindings: RuleFinding[];

  constructor(input: CreateReviewItemInput) {
    this.messageId = input.messageId;
    this.#candidateMessage = input.candidateMessage;
    this.#allowedFacts = input.allowedFacts;
    this.#draft = input.draft;
    this.#ruleFindings = ruleCheck(
      input.draft,
      input.candidateMessage,
      input.allowedFacts,
    ).findings;
  }

  get draft(): string {
    return this.#draft;
  }

  get status(): ReviewStatus {
    return this.#status;
  }

  get ruleFindings(): RuleFinding[] {
    return this.#ruleFindings;
  }

  approve(): this {
    if (this.#status !== "pending") {
      throw new ReviewGateError(
        `Cannot approve a draft with status "${this.#status}".`,
      );
    }
    this.#status = "approved";
    return this;
  }

  edit(newDraft: string): this {
    if (this.#status === "sent") {
      throw new ReviewGateError("A sent draft cannot be edited.");
    }
    this.#draft = newDraft;
    this.#status = "pending";
    this.#ruleFindings = ruleCheck(
      newDraft,
      this.#candidateMessage,
      this.#allowedFacts,
    ).findings;
    return this;
  }

  reject(): this {
    if (this.#status === "sent") {
      throw new ReviewGateError("A sent draft cannot be rejected.");
    }
    this.#status = "rejected";
    return this;
  }

  markSent(): this {
    if (this.#status !== "approved") {
      throw new ReviewGateError(
        `Cannot send a draft with status "${this.#status}".`,
      );
    }
    this.#status = "sent";
    return this;
  }
}

export function createReviewItem(input: CreateReviewItemInput): ReviewItem {
  return new ReviewItem(input);
}

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ruleCheck } from "../src/ruleCheck";

const allowedFacts = JSON.parse(
  readFileSync(resolve(process.cwd(), "data", "allowed-facts.json"), "utf8"),
) as Record<string, unknown>;

const findingKinds = (result: ReturnType<typeof ruleCheck>) =>
  result.findings.map((finding) => finding.kind);

describe("ruleCheck", () => {
  it("flags a date that is not in the candidate message or the allowed facts", () => {
    const result = ruleCheck(
      "We can meet on Saturday.",
      "Can we meet?",
      allowedFacts,
    );

    expect(result.ok).toBe(false);
    expect(findingKinds(result)).toContain("date");
    expect(
      result.findings.some(
        (finding) => finding.kind === "date" && /saturday/i.test(finding.text),
      ),
    ).toBe(true);
  });

  it("flags a time that is not in the candidate message or the allowed facts", () => {
    const result = ruleCheck(
      "Your interview is at 10am.",
      "What time is my interview?",
      allowedFacts,
    );

    expect(result.ok).toBe(false);
    expect(findingKinds(result)).toContain("time");
    expect(
      result.findings.some(
        (finding) => finding.kind === "time" && /10am/i.test(finding.text),
      ),
    ).toBe(true);
  });

  it("flags an amount that is not in the candidate message or the allowed facts", () => {
    const result = ruleCheck(
      "The salary is 500,000 naira.",
      "What is the salary?",
      allowedFacts,
    );

    expect(result.ok).toBe(false);
    expect(findingKinds(result)).toContain("amount");
    expect(
      result.findings.some(
        (finding) => finding.kind === "amount" && /500,000/i.test(finding.text),
      ),
    ).toBe(true);
  });

  it("does not flag a date, time or amount copied from the candidate message", () => {
    const candidateMessage =
      "I am free Monday at 9am and my current pay is 900,000 naira.";

    const result = ruleCheck(
      "Thanks, I have noted Monday at 9am and 900,000 naira.",
      candidateMessage,
      allowedFacts,
    );

    expect(result).toEqual({ ok: true, findings: [] });
  });

  it("does not flag facts supplied in data/allowed-facts.json", () => {
    const result = ruleCheck(
      "Interviews are held on Friday.",
      "Can we schedule an interview?",
      allowedFacts,
    );

    expect(result).toEqual({ ok: true, findings: [] });
  });

  it("reports every invented value when a draft has several", () => {
    const result = ruleCheck(
      "Let's meet on Saturday at 10am about the 500,000 naira offer.",
      "Can we talk?",
      allowedFacts,
    );

    expect(result.ok).toBe(false);
    expect(new Set(findingKinds(result))).toEqual(
      new Set(["date", "time", "amount"]),
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  FLAGS,
  FlagSchema,
  INTENTS,
  IntentSchema,
  ModelOutputSchema,
} from "../src/types.js";

const validOutput = {
  intents: ["scheduling"],
  flags: [],
  draft: "Thanks. The team will follow up.",
};

describe("model output schema", () => {
  it("uses exactly the intent names from directive.md", () => {
    expect(INTENTS).toEqual([
      "scheduling",
      "status",
      "salary",
      "withdrawal",
      "complaint",
      "unclear",
      "other",
    ]);

    for (const intent of INTENTS) {
      expect(IntentSchema.safeParse(intent).success).toBe(true);
    }
    expect(IntentSchema.safeParse("billing").success).toBe(false);
  });

  it("uses exactly the flag names from directive.md", () => {
    expect(FLAGS).toEqual(["injection", "sensitive"]);

    for (const flag of FLAGS) {
      expect(FlagSchema.safeParse(flag).success).toBe(true);
    }
    expect(FlagSchema.safeParse("urgent").success).toBe(false);
  });

  it("accepts the directive output shape", () => {
    expect(ModelOutputSchema.safeParse(validOutput).success).toBe(true);
    expect(
      ModelOutputSchema.safeParse({
        intents: ["status", "scheduling"],
        flags: ["injection"],
        draft: "We are checking your application and will follow up.",
      }).success,
    ).toBe(true);
  });

  it("rejects unknown intent and flag names", () => {
    expect(
      ModelOutputSchema.safeParse({
        ...validOutput,
        intents: ["billing"],
      }).success,
    ).toBe(false);

    expect(
      ModelOutputSchema.safeParse({
        ...validOutput,
        flags: ["urgent"],
      }).success,
    ).toBe(false);
  });

  it("requires at least one intent and a present flags array", () => {
    expect(
      ModelOutputSchema.safeParse({
        ...validOutput,
        intents: [],
      }).success,
    ).toBe(false);

    expect(
      ModelOutputSchema.safeParse({
        intents: ["status"],
        draft: "Draft.",
      }).success,
    ).toBe(false);
  });

  it("requires a non-empty string draft", () => {
    expect(
      ModelOutputSchema.safeParse({
        ...validOutput,
        draft: "",
      }).success,
    ).toBe(false);

    expect(
      ModelOutputSchema.safeParse({
        intents: ["status"],
        flags: [],
        draft: 42,
      }).success,
    ).toBe(false);
  });
});

import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MIN_INTENT_ACCURACY } from "../src/config";
import { analyzeMessage } from "../src/llm";

interface Message {
  id: number;
  text: string;
}

interface ExpectedLabel {
  id: number;
  intents: string[];
  flags: string[];
}

const readJson = <T>(fileName: string): T =>
  JSON.parse(
    readFileSync(resolve(process.cwd(), "data", fileName), "utf8"),
  ) as T;

const messages = readJson<Message[]>("messages.json");
const expectedLabels = readJson<ExpectedLabel[]>("expected-labels.json");
const allowedFacts = readJson<Record<string, unknown>>("allowed-facts.json");

const rawApiKey = process.env.GEMINI_API_KEY?.trim().toLowerCase();
const hasApiKey = Boolean(rawApiKey && rawApiKey !== "paste_your_key_here");

const messagesById = new Map(messages.map((message) => [message.id, message]));

const normalize = (values: string[]) => [...new Set(values)].sort();
const sameSet = (left: string[], right: string[]) =>
  JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));

const list = (values: string[]) =>
  values.length > 0 ? values.join(", ") : "(none)";

describe.skipIf(!hasApiKey)(
  "model accuracy against data/expected-labels.json",
  () => {
    it("reports exact intent and flag agreement without tuning to the labels", async () => {
      const labelsById = new Map(
        expectedLabels.map((label) => [label.id, label]),
      );

      let intentHits = 0;
      let flagHits = 0;
      const misses: string[] = [];

      for (const message of messages) {
        const expected = labelsById.get(message.id);
        if (!expected) {
          throw new Error(`No expected label for message ${message.id}`);
        }

        const actual = await analyzeMessage(message, allowedFacts);
        const intentsMatch = sameSet(actual.intents, expected.intents);
        const flagsMatch = sameSet(actual.flags, expected.flags);

        if (intentsMatch) intentHits++;
        if (flagsMatch) flagHits++;

        if (!intentsMatch || !flagsMatch) {
          misses.push(
            `#${message.id} expected intents=[${list(expected.intents)}] ` +
              `flags=[${list(expected.flags)}]; actual ` +
              `intents=[${list(actual.intents)}] ` +
              `flags=[${list(actual.flags)}]`,
          );
        }
      }

      const intentAccuracy = intentHits / messages.length;
      const flagAccuracy = flagHits / messages.length;

      console.log(
        `intent accuracy: ${(intentAccuracy * 100).toFixed(1)}% ` +
          `(${intentHits}/${messages.length})`,
      );
      console.log(
        `flag accuracy: ${(flagAccuracy * 100).toFixed(1)}% ` +
          `(${flagHits}/${messages.length})`,
      );
      console.log(
        misses.length > 0
          ? `misses:\n${misses.join("\n")}`
          : "misses: none",
      );

      expect(intentAccuracy).toBeGreaterThanOrEqual(MIN_INTENT_ACCURACY);
    }, 180_000);
  },
);

describe.skipIf(!hasApiKey)("required safety flags", () => {
  it("flags injection on 18, 19, 20 and sensitive on 29", async () => {
    const required: { id: number; flag: string }[] = [
      { id: 18, flag: "injection" },
      { id: 19, flag: "injection" },
      { id: 20, flag: "injection" },
      { id: 29, flag: "sensitive" },
    ];

    for (const { id, flag } of required) {
      const message = messagesById.get(id);
      if (!message) {
        throw new Error(`Message ${id} not found in data/messages.json`);
      }

      const actual = await analyzeMessage(message, allowedFacts);
      expect(
        actual.flags,
        `message ${id} should include the "${flag}" flag; got [${list(actual.flags)}]`,
      ).toContain(flag);
    }
  }, 120_000);
});

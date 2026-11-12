import type {
  AllowedFacts,
  RuleCheckResult,
  RuleFinding,
  RuleFindingKind,
} from "./types.js";

const DATE_PATTERNS: readonly RegExp[] = [
  /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?\b/gi,
  /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g,
  /\b(?:today|tomorrow|yesterday|next\s+week|next\s+month|this\s+week|this\s+month)\b/gi,
];

const TIME_PATTERNS: readonly RegExp[] = [
  /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi,
  /\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g,
  /\b(?:noon|midday|midnight)\b/gi,
];

const AMOUNT_PATTERNS: readonly RegExp[] = [
  /(?:₦|ngn|usd|\$|€|£)\s?\d[\d,]*(?:\.\d+)?\b/gi,
  /\b\d[\d,]*(?:\.\d+)?\s*(?:naira|ngn|usd|dollars?|euros?|pounds?)\b/gi,
  /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g,
  /\b\d+(?:\.\d+)?\s*(?:k|m)\b/gi,
];

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/(?<=\d),(?=\d)/g, "")
    .replace(/(\d)\s*(am|pm)\b/g, "$1$2")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const collect = (text: string, patterns: readonly RegExp[]): string[] =>
  patterns.flatMap((pattern) => text.match(pattern) ?? []);

export function ruleCheck(
  draft: string,
  candidateMessage: string,
  allowedFacts: AllowedFacts,
): RuleCheckResult {
  const searchable = ` ${normalize(
    `${candidateMessage} ${JSON.stringify(allowedFacts)}`,
  )} `;

  const findings: RuleFinding[] = [];
  const seen = new Set<string>();

  const groups: ReadonlyArray<[RuleFindingKind, readonly RegExp[]]> = [
    ["date", DATE_PATTERNS],
    ["time", TIME_PATTERNS],
    ["amount", AMOUNT_PATTERNS],
  ];

  for (const [kind, patterns] of groups) {
    for (const text of collect(draft, patterns)) {
      const normalized = normalize(text);
      if (!normalized) {
        continue;
      }

      const key = `${kind}:${normalized}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      if (!searchable.includes(` ${normalized} `)) {
        findings.push({ kind, text });
      }
    }
  }

  const deduped = findings.filter((finding) => {
    const normalized = normalize(finding.text);
    return !findings.some((other) => {
      if (other === finding || other.kind !== finding.kind) {
        return false;
      }
      const otherNormalized = normalize(other.text);
      return (
        otherNormalized !== normalized &&
        otherNormalized.includes(normalized)
      );
    });
  });

  return { ok: deduped.length === 0, findings: deduped };
}

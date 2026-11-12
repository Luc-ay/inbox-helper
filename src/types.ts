import { z } from "zod";

export const INTENTS = [
  "scheduling",
  "status",
  "salary",
  "withdrawal",
  "complaint",
  "unclear",
  "other",
] as const;

export const FLAGS = ["injection", "sensitive"] as const;

export const IntentSchema = z.enum(INTENTS);
export const FlagSchema = z.enum(FLAGS);

export const ModelOutputSchema = z.object({
  intents: z.array(IntentSchema).min(1),
  flags: z.array(FlagSchema),
  draft: z.string().trim().min(1),
});

export type Intent = z.infer<typeof IntentSchema>;
export type Flag = z.infer<typeof FlagSchema>;
export type ModelOutput = z.infer<typeof ModelOutputSchema>;

export interface Message {
  id: number;
  text: string;
}

export type AllowedFacts = Record<string, unknown>;

export type RuleFindingKind = "date" | "time" | "amount";

export interface RuleFinding {
  kind: RuleFindingKind;
  text: string;
}

export interface RuleCheckResult {
  ok: boolean;
  findings: RuleFinding[];
}

export type ReviewStatus = "pending" | "approved" | "rejected" | "sent";

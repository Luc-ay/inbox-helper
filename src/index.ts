import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  ANALYSIS_CONCURRENCY,
  getApiKey,
  MESSAGE_DELAY_MS,
} from "./config.js";
import { loadPipelineInput, runPipeline } from "./pipeline.js";
import type { PipelineItem } from "./pipeline.js";

type Decision = "sent" | "rejected";

const formatList = (values: readonly string[]): string =>
  values.length > 0 ? values.join(", ") : "(none)";

const formatFindings = (item: PipelineItem): string => {
  if (item.review.ruleFindings.length === 0) {
    return "clean";
  }
  return item.review.ruleFindings
    .map((finding) => `${finding.kind} "${finding.text}"`)
    .join(", ");
};

const reviewItem = async (
  rl: ReturnType<typeof createInterface>,
  item: PipelineItem,
  index: number,
  total: number,
): Promise<Decision> => {
  for (;;) {
    console.log(
      `\n[${index + 1}/${total}] Message #${item.message.id}`,
    );
    console.log(`Candidate: ${item.message.text}`);
    console.log(`Intents: ${formatList(item.output.intents)}`);
    console.log(`Flags: ${formatList(item.output.flags)}`);
    if (item.issue) {
      console.log(
        `MODEL ISSUE: ${item.issue}${
          item.errorMessage ? ` - ${item.errorMessage}` : ""
        }`,
      );
    }
    console.log(`Draft: ${item.review.draft}`);
    console.log(`Rule check: ${formatFindings(item)}`);

    const answer = (await rl.question("Approve / Edit / Reject [a/e/r]: "))
      .trim()
      .toLowerCase();

    if (answer === "a" || answer === "approve") {
      item.review.approve();
      item.review.markSent();
      console.log("Sent (mocked).");
      return "sent";
    }

    if (answer === "r" || answer === "reject") {
      item.review.reject();
      console.log("Rejected.");
      return "rejected";
    }

    if (answer === "e" || answer === "edit") {
      const newDraft = (await rl.question("New draft: ")).trim();
      if (!newDraft) {
        console.log("Draft cannot be empty.");
        continue;
      }
      item.review.edit(newDraft);
      console.log(
        "Draft edited; rule check re-run. It still needs approval.",
      );
      continue;
    }

    console.log("Please choose approve, edit, or reject.");
  }
};

export async function main(): Promise<void> {
  if (!getApiKey()) {
    console.error(
      "GEMINI_API_KEY is missing or still set to the placeholder value.",
    );
    process.exitCode = 1;
    return;
  }

  const { messages, allowedFacts } = loadPipelineInput();
  console.log(
    `Analyzing ${messages.length} messages with up to ${ANALYSIS_CONCURRENCY} at once and a ${MESSAGE_DELAY_MS}ms delay.`,
  );

  const items = await runPipeline(messages, allowedFacts, {
    onProgress: (item, index, total) => {
      const issue = item.issue ? ` [${item.issue}]` : "";
      console.log(
        `Analyzed ${index + 1}/${total}: message #${item.message.id}${issue}`,
      );
    },
  });

  const rl = createInterface({ input: stdin, output: stdout });
  let sent = 0;
  let rejected = 0;

  try {
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (!item) {
        continue;
      }
      const decision = await reviewItem(rl, item, index, items.length);
      if (decision === "sent") {
        sent++;
      } else {
        rejected++;
      }
    }
  } finally {
    rl.close();
  }

  const issues = items.filter((item) => item.issue !== null);
  console.log("\nSummary");
  console.log(`Reviewed: ${items.length}`);
  console.log(`Sent (mocked): ${sent}`);
  console.log(`Rejected: ${rejected}`);
  console.log(`Model issues requiring review: ${issues.length}`);
  for (const item of issues) {
    console.log(`  - message #${item.message.id}: ${item.issue}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

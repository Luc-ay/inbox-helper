import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import { GEMINI_MODEL, UI_DIR, UI_PORT, getApiKey } from "./config.js";
import { loadPipelineInput, runPipeline } from "./pipeline.js";
import type { PipelineIssue, PipelineItem } from "./pipeline.js";
import { ReviewGateError } from "./review.js";
import type {
  AllowedFacts,
  Flag,
  Intent,
  Message,
  ReviewStatus,
  RuleFinding,
} from "./types.js";

interface PipelineItemDto {
  message: Message;
  intents: Intent[];
  flags: Flag[];
  draft: string;
  status: ReviewStatus;
  ruleFindings: RuleFinding[];
  issue: PipelineIssue | null;
  errorMessage: string | null;
}

class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

const STATIC_FILES: Record<
  string,
  { file: string; contentType: string }
> = {
  "/": {
    file: resolve(UI_DIR, "index.html"),
    contentType: "text/html; charset=utf-8",
  },
  "/index.html": {
    file: resolve(UI_DIR, "index.html"),
    contentType: "text/html; charset=utf-8",
  },
  "/styles.css": {
    file: resolve(UI_DIR, "styles.css"),
    contentType: "text/css; charset=utf-8",
  },
  "/app.js": {
    file: resolve(UI_DIR, "app.js"),
    contentType: "text/javascript; charset=utf-8",
  },
};

const itemsByMessageId = new Map<number, PipelineItem>();

const toDto = (item: PipelineItem): PipelineItemDto => ({
  message: item.message,
  intents: item.output.intents,
  flags: item.output.flags,
  draft: item.review.draft,
  status: item.review.status,
  ruleFindings: item.review.ruleFindings,
  issue: item.issue,
  errorMessage: item.errorMessage,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readJsonBody = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > 1_000_000) {
      throw new HttpError(413, "Request body is too large.");
    }
    chunks.push(buffer);
  }

  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
};

const sendJson = (
  res: ServerResponse,
  status: number,
  body: unknown,
): void => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
};

const sendError = (
  res: ServerResponse,
  status: number,
  message: string,
): void => {
  sendJson(res, status, { error: message });
};

const serveStatic = (pathname: string, res: ServerResponse): boolean => {
  const entry = STATIC_FILES[pathname];
  if (!entry) {
    return false;
  }

  res.writeHead(200, {
    "Content-Type": entry.contentType,
    "Cache-Control": "no-store",
  });
  res.end(readFileSync(entry.file));
  return true;
};

const analyze = async (
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  const body = await readJsonBody(req);
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  let messageId: number | undefined;
  if (body.messageId !== undefined) {
    if (
      typeof body.messageId !== "number" ||
      !Number.isInteger(body.messageId)
    ) {
      throw new HttpError(400, "messageId must be an integer.");
    }
    messageId = body.messageId;
  }

  const { messages, allowedFacts } = loadPipelineInput();
  const targets =
    messageId === undefined
      ? messages
      : messages.filter((message) => message.id === messageId);

  if (targets.length === 0) {
    throw new HttpError(404, `Message ${messageId} was not found.`);
  }

  if (messageId === undefined) {
    itemsByMessageId.clear();
  }

  const results = await runPipeline(targets, allowedFacts);
  for (const item of results) {
    itemsByMessageId.set(item.message.id, item);
  }

  sendJson(res, 200, { items: results.map(toDto) });
};

const review = async (
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  const body = await readJsonBody(req);
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  if (
    typeof body.messageId !== "number" ||
    !Number.isInteger(body.messageId)
  ) {
    throw new HttpError(400, "messageId must be an integer.");
  }

  const action = body.action;
  if (
    action !== "approve" &&
    action !== "edit" &&
    action !== "reject" &&
    action !== "send"
  ) {
    throw new HttpError(
      400,
      "action must be approve, edit, reject, or send.",
    );
  }

  const item = itemsByMessageId.get(body.messageId);
  if (!item) {
    throw new HttpError(
      404,
      "Analyze the message before reviewing it.",
    );
  }

  if (action === "edit") {
    if (typeof body.draft !== "string" || body.draft.trim() === "") {
      throw new HttpError(400, "draft must be a non-empty string.");
    }
    item.review.edit(body.draft);
  } else if (action === "approve") {
    item.review.approve();
  } else if (action === "reject") {
    item.review.reject();
  } else {
    item.review.markSent();
  }

  sendJson(res, 200, { item: toDto(item) });
};

const status = (res: ServerResponse): void => {
  const { messages } = loadPipelineInput();
  sendJson(res, 200, {
    hasApiKey: Boolean(getApiKey()),
    model: GEMINI_MODEL,
    messageCount: messages.length,
  });
};

const messages = (res: ServerResponse): void => {
  const { messages: candidateMessages, allowedFacts } = loadPipelineInput();
  sendJson(res, 200, {
    messages: candidateMessages,
    allowedFacts: allowedFacts as AllowedFacts,
  });
};

const handleRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  const method = req.method ?? "GET";
  const url = new URL(
    req.url ?? "/",
    `http://${req.headers.host ?? "localhost"}`,
  );

  if (method === "GET" && serveStatic(url.pathname, res)) {
    return;
  }

  if (method === "GET" && url.pathname === "/api/status") {
    status(res);
    return;
  }

  if (method === "GET" && url.pathname === "/api/messages") {
    messages(res);
    return;
  }

  if (method === "POST" && url.pathname === "/api/analyze") {
    await analyze(req, res);
    return;
  }

  if (method === "POST" && url.pathname === "/api/review") {
    await review(req, res);
    return;
  }

  sendError(res, 404, "Not found.");
};

const server = createServer((req, res) => {
  handleRequest(req, res).catch((error: unknown) => {
    if (error instanceof HttpError) {
      sendError(res, error.status, error.message);
      return;
    }
    if (error instanceof ReviewGateError) {
      sendError(res, 409, error.message);
      return;
    }
    console.error(error);
    sendError(
      res,
      500,
      error instanceof Error ? error.message : "Internal server error.",
    );
  });
});

server.listen(UI_PORT, () => {
  console.log(`Inbox Helper UI running at http://localhost:${UI_PORT}`);
  if (!getApiKey()) {
    console.log(
      "No real GEMINI_API_KEY detected. Analyze will produce flagged fallback items.",
    );
  }
});

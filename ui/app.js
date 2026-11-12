const analyzeAllButton = document.getElementById("analyze-all");
const reloadButton = document.getElementById("reload");
const summary = document.getElementById("summary");
const notice = document.getElementById("notice");
const list = document.getElementById("message-list");
const template = document.getElementById("message-template");
const apiDot = document.getElementById("api-dot");
const apiStatusText = document.getElementById("api-status-text");

let messages = [];
let items = new Map();
let busy = false;

const request = async (url, options = {}) => {
  const init = { ...options };
  if (init.body) {
    init.headers = {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    };
  }

  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed with ${response.status}.`);
  }
  return data;
};

const setNotice = (text, kind = "") => {
  notice.textContent = text;
  notice.className = `notice ${kind}`.trim();
};

const setBusy = (value) => {
  busy = value;
  analyzeAllButton.disabled = value;
  reloadButton.disabled = value;
  document.body.classList.toggle("busy", value);
};

const makeChip = (text, kind = "") => {
  const chip = document.createElement("span");
  chip.className = `chip ${kind}`.trim();
  chip.textContent = text;
  return chip;
};

const renderSummary = () => {
  const counts = {
    analyzed: items.size,
    pending: 0,
    approved: 0,
    rejected: 0,
    sent: 0,
    issues: 0,
  };

  for (const item of items.values()) {
    if (Object.hasOwn(counts, item.status)) {
      counts[item.status] += 1;
    }
    if (item.issue) {
      counts.issues += 1;
    }
  }

  summary.textContent =
    `${counts.analyzed}/${messages.length} analyzed` +
    ` · ${counts.pending} pending` +
    ` · ${counts.approved} approved` +
    ` · ${counts.sent} sent` +
    ` · ${counts.rejected} rejected` +
    ` · ${counts.issues} flagged`;
};

const render = () => {
  list.replaceChildren();

  for (const message of messages) {
    const item = items.get(message.id);
    const card = template.content.firstElementChild.cloneNode(true);
    card.dataset.messageId = String(message.id);

    card.querySelector(".message-id").textContent = `Message #${message.id}`;
    card.querySelector(".candidate-text").textContent = message.text;

    const badge = card.querySelector(".status-badge");
    badge.textContent = item ? item.status : "not analyzed";
    badge.classList.add(item ? item.status : "unanalyzed");

    const intents = card.querySelector(".intents");
    const flags = card.querySelector(".flags");

    if (!item) {
      intents.append(makeChip("not analyzed", "muted"));
      flags.append(makeChip("not analyzed", "muted"));
    } else {
      if (item.intents.length > 0) {
        item.intents.forEach((intent) => {
          intents.append(makeChip(intent));
        });
      } else {
        intents.append(makeChip("no intents", "muted"));
      }

      if (item.flags.length > 0) {
        item.flags.forEach((flag) => {
          flags.append(makeChip(flag, "flag"));
        });
      } else {
        flags.append(makeChip("no flags", "muted"));
      }
    }

    const issue = card.querySelector(".issue");
    if (item?.issue) {
      issue.classList.remove("hidden");
      issue.textContent =
        `Model issue: ${item.issue}` +
        (item.errorMessage ? ` — ${item.errorMessage}` : "");
    }

    const draft = card.querySelector(".draft");
    draft.value = item?.draft ?? "";
    draft.disabled = !item || item.status === "sent";

    const ruleCheck = card.querySelector(".rule-check");
    if (!item) {
      ruleCheck.textContent = "Rule check: not run";
    } else if (item.ruleFindings.length === 0) {
      ruleCheck.textContent = "Rule check: clean";
      ruleCheck.classList.add("clean");
    } else {
      ruleCheck.textContent =
        "Rule check: " +
        item.ruleFindings
          .map((finding) => `${finding.kind} "${finding.text}"`)
          .join(", ");
      ruleCheck.classList.add("warning");
    }

    const analyzeButton = card.querySelector(".analyze-btn");
    const approveButton = card.querySelector(".approve-btn");
    const saveButton = card.querySelector(".save-btn");
    const rejectButton = card.querySelector(".reject-btn");
    const sendButton = card.querySelector(".send-btn");

    analyzeButton.disabled = item?.status === "sent";
    approveButton.disabled = !item || item.status !== "pending";
    saveButton.disabled = !item || item.status === "sent";
    rejectButton.disabled = !item || item.status === "sent";
    sendButton.disabled = !item || item.status !== "approved";

    analyzeButton.addEventListener("click", () => {
      void analyze(message.id);
    });
    approveButton.addEventListener("click", () => {
      void review(message.id, "approve");
    });
    saveButton.addEventListener("click", () => {
      void review(message.id, "edit", draft.value.trim());
    });
    rejectButton.addEventListener("click", () => {
      void review(message.id, "reject");
    });
    sendButton.addEventListener("click", () => {
      void review(message.id, "send");
    });

    list.append(card);
  }

  renderSummary();
};

const applyItems = (newItems) => {
  for (const item of newItems) {
    items.set(item.message.id, item);
  }
};

const analyze = async (messageId) => {
  if (busy) {
    return;
  }

  setBusy(true);
  setNotice(
    messageId === undefined
      ? "Analyzing all messages..."
      : `Analyzing message #${messageId}...`,
  );

  try {
    const data = await request("/api/analyze", {
      method: "POST",
      body: JSON.stringify(
        messageId === undefined ? {} : { messageId },
      ),
    });
    applyItems(data.items);
    setNotice(
      `Analyzed ${data.items.length} message${
        data.items.length === 1 ? "" : "s"
      }.`,
    );
  } catch (error) {
    setNotice(error.message, "error");
  } finally {
    setBusy(false);
    render();
  }
};

const review = async (messageId, action, draft) => {
  if (busy) {
    return;
  }

  setBusy(true);
  setNotice(`Applying ${action} to message #${messageId}...`);

  try {
    const body = { messageId, action };
    if (action === "edit") {
      body.draft = draft;
    }

    const data = await request("/api/review", {
      method: "POST",
      body: JSON.stringify(body),
    });
    items.set(data.item.message.id, data.item);
    setNotice(`Message #${messageId} is now ${data.item.status}.`);
  } catch (error) {
    setNotice(error.message, "error");
  } finally {
    setBusy(false);
    render();
  }
};

const loadStatus = async () => {
  const status = await request("/api/status");
  apiDot.classList.toggle("ok", status.hasApiKey);
  apiDot.classList.toggle("warn", !status.hasApiKey);
  apiStatusText.textContent = status.hasApiKey
    ? `API ready · ${status.model}`
    : `No real API key · ${status.model} fallback mode`;
  return status;
};

const loadMessages = async () => {
  const data = await request("/api/messages");
  messages = data.messages;
  items = new Map();
  render();
  return data;
};

const init = async () => {
  try {
    const status = await loadStatus();
    await loadMessages();
    if (!status.hasApiKey) {
      setNotice(
        "No real GEMINI_API_KEY detected. Analyze will produce flagged fallback items for review.",
        "warning",
      );
    }
  } catch (error) {
    setNotice(error.message, "error");
  }
};

analyzeAllButton.addEventListener("click", () => {
  void analyze(undefined);
});

reloadButton.addEventListener("click", async () => {
  if (busy) {
    return;
  }

  setBusy(true);
  try {
    await loadMessages();
    setNotice("Messages reloaded.");
  } catch (error) {
    setNotice(error.message, "error");
  } finally {
    setBusy(false);
  }
});

void init();

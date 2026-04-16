import { DecisionRequest, ComputedSignals, RiskTier } from "./types";

// ─── Keyword Dictionaries ─────────────────────────────────────────────────────

const IRREVERSIBLE_KEYWORDS = [
  "delete",
  "remove",
  "cancel",
  "terminate",
  "unsubscribe",
  "permanently",
  "drop",
  "destroy",
  "wipe",
  "clear all",
  "send",
  "reply",
  "forward",
  "publish",
  "post",
];

const HIGH_RISK_KEYWORDS = [
  "all",
  "everyone",
  "entire",
  "bulk",
  "every",
  "whole",
  "external",
  "partner",
  "client",
  "legal",
  "contract",
  "discount",
  "price",
  "payment",
  "invoice",
  "confidential",
];

const CLARIFICATION_NEEDED_PRONOUNS = [
  "it",
  "that",
  "this",
  "them",
  "those",
  "the email",
  "the message",
  "the draft",
  "the file",
];

const EXTERNAL_ACTION_KEYWORDS = [
  "send",
  "reply",
  "forward",
  "email",
  "message",
  "external",
  "partner",
  "client",
  "vendor",
];

const BULK_ACTION_KEYWORDS = [
  "all",
  "every",
  "entire",
  "bulk",
  "everyone",
  "all emails",
  "all events",
  "all reminders",
];

// ─── Helper: normalize text ───────────────────────────────────────────────────

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

function containsAny(text: string, keywords: string[]): boolean {
  const n = normalize(text);
  return keywords.some((kw) => n.includes(kw));
}

// ─── Signal: Reversibility Score ─────────────────────────────────────────────
// Returns 0.0 (fully reversible) to 1.0 (completely irreversible)

export function computeReversibilityScore(action: string): number {
  const n = normalize(action);

  // Highest irreversibility: permanent deletion or bulk send to externals
  if (
    (n.includes("delete") || n.includes("permanently") || n.includes("wipe")) &&
    containsAny(n, BULK_ACTION_KEYWORDS)
  ) {
    return 1.0;
  }

  // High: sending external communications
  if (containsAny(n, ["send", "reply", "forward", "publish", "post"])) {
    return 0.8;
  }

  // Medium-high: single deletions or cancellations
  if (containsAny(n, ["delete", "remove", "cancel", "terminate", "unsubscribe"])) {
    return 0.65;
  }

  // Medium: calendar modifications
  if (containsAny(n, ["reschedule", "move", "update", "change"])) {
    return 0.3;
  }

  // Low: read-only or additive operations
  return 0.1;
}

// ─── Signal: Intent Clarity Score ────────────────────────────────────────────
// Returns 0.0 (completely unclear) to 1.0 (fully resolved)

export function computeIntentClarityScore(
  latestMessage: string,
  proposedAction: string
): number {
  const msg = normalize(latestMessage);
  const action = normalize(proposedAction);

  let score = 1.0;

  // Penalize if latest message is very short (likely a pronoun or bare affirmative)
  if (latestMessage.trim().split(" ").length <= 3) {
    score -= 0.35;
  }

  // Penalize for unresolved pronouns in the latest message
  if (containsAny(msg, CLARIFICATION_NEEDED_PRONOUNS)) {
    score -= 0.3;
  }

  // Penalize if proposed action contains "unknown" — signals unresolved entity
  if (action.includes("unknown")) {
    score -= 0.4;
  }

  // Penalize for vague language
  const vaguePhrases = ["my decision", "the thing", "whatever", "you know", "that stuff"];
  if (containsAny(msg, vaguePhrases)) {
    score -= 0.35;
  }

  return Math.max(0, Math.min(1, score));
}

// ─── Signal: Risk Tier ────────────────────────────────────────────────────────

export function computeRiskTier(
  reversibilityScore: number,
  intentClarityScore: number,
  isBulkAction: boolean,
  isExternalAction: boolean
): RiskTier {
  const riskScore =
    reversibilityScore * 0.5 +
    (1 - intentClarityScore) * 0.25 +
    (isBulkAction ? 0.15 : 0) +
    (isExternalAction ? 0.1 : 0);

  if (riskScore >= 0.85) return "CRITICAL";
  if (riskScore >= 0.6) return "HIGH";
  if (riskScore >= 0.35) return "MEDIUM";
  return "LOW";
}

// ─── Signal: Context Contradiction ───────────────────────────────────────────
// Detects if the user previously said "hold off", "wait", "don't", "stop", etc.
// and has now issued what looks like a go-ahead without explicit reversal.

export function detectContextContradiction(
  latestMessage: string,
  history: DecisionRequest["conversationHistory"]
): boolean {
  const holdOffPhrases = [
    "hold off",
    "wait",
    "don't send",
    "do not send",
    "stop",
    "not yet",
    "pause",
    "delay",
    "cancel that",
    "never mind",
    "hold on",
    "let me think",
    "wait for",
    "pending",
  ];

  const goAheadPhrases = [
    "send it",
    "go ahead",
    "do it",
    "yes",
    "yep",
    "confirm",
    "ok",
    "okay",
    "proceed",
    "approved",
    "send",
    "do that",
  ];

  const historyText = history.map((t) => normalize(t.content)).join(" ");
  const latest = normalize(latestMessage);

  const priorHoldOff = holdOffPhrases.some((p) => historyText.includes(p));
  const currentGoAhead = goAheadPhrases.some((p) => latest.includes(p));

  // Contradiction: user previously paused but now seems to go ahead
  // without explicitly acknowledging the reversal
  if (priorHoldOff && currentGoAhead) {
    // Check if the user explicitly cleared the hold in the latest message
    const clearancePhrases = [
      "legal approved",
      "got approval",
      "it's cleared",
      "all good now",
      "reviewed",
      "confirmed by",
    ];
    const isCleared = clearancePhrases.some((p) => latest.includes(p));
    return !isCleared;
  }

  return false;
}

// ─── Signal: Missing Params ───────────────────────────────────────────────────

export function detectMissingParams(
  proposedAction: string,
  latestMessage: string
): string[] {
  const missing: string[] = [];
  const action = normalize(proposedAction);
  const msg = normalize(latestMessage);

  // Email/message actions need a recipient
  if (
    containsAny(action, ["send", "reply", "forward", "email"]) &&
    !containsAny(action, ["@", "to ", "partner", "team", "acme", "client"])
  ) {
    missing.push("recipient");
  }

  // Email/message actions need content or a draft reference
  if (
    containsAny(action, ["send", "reply", "email"]) &&
    !containsAny(action, ["draft", "re:", "subject", "discount", "decision", "partnership"])
  ) {
    missing.push("message_content");
  }

  // Calendar actions need a time
  if (
    containsAny(action, ["schedule", "block", "remind", "meeting"]) &&
    !containsAny(action + msg, [
      "am",
      "pm",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "tomorrow",
      "today",
      "morning",
      "afternoon",
      "evening",
      "12:00",
      "1:00",
      "2:00",
      "3:00",
      "4:00",
      "5:00",
    ])
  ) {
    missing.push("time_or_date");
  }

  return missing;
}

// ─── Main: computeSignals ─────────────────────────────────────────────────────

export function computeSignals(request: DecisionRequest): ComputedSignals {
  const { proposedAction, latestMessage, conversationHistory } = request;

  const reversibilityScore = computeReversibilityScore(proposedAction);
  const intentClarityScore = computeIntentClarityScore(latestMessage, proposedAction);
  const isExternalAction = containsAny(proposedAction, EXTERNAL_ACTION_KEYWORDS);
  const isBulkAction = containsAny(proposedAction, BULK_ACTION_KEYWORDS);
  const riskTier = computeRiskTier(
    reversibilityScore,
    intentClarityScore,
    isBulkAction,
    isExternalAction
  );
  const contextContradiction = detectContextContradiction(
    latestMessage,
    conversationHistory
  );
  const missingParams = detectMissingParams(proposedAction, latestMessage);
  const missingCriticalContext = !conversationHistory || conversationHistory.length === 0;

  // ─── Pre-filter Rules ───────────────────────────────────────────────────────
  // Short-circuit the pipeline for clear-cut cases without calling the LLM.

  let preFilterTriggered = false;
  let preFilterReason: string | undefined;

  if (riskTier === "CRITICAL" && reversibilityScore >= 0.9) {
    preFilterTriggered = true;
    preFilterReason =
      "CRITICAL risk tier with near-total irreversibility detected. " +
      "Refusing without LLM call to guarantee safe default behavior.";
  } else if (intentClarityScore < 0.25) {
    preFilterTriggered = true;
    preFilterReason =
      "Intent clarity score is below 0.25. Key parameters or entities " +
      "are unresolved. Escalating to CLARIFY without LLM call.";
  }

  return {
    reversibilityScore,
    intentClarityScore,
    riskTier,
    contextContradiction,
    missingParams,
    missingCriticalContext,
    isExternalAction,
    isBulkAction,
    preFilterTriggered,
    preFilterReason,
  };
}

// ─── Decision Outcomes ───────────────────────────────────────────────────────

export type DecisionOutcome =
  | "EXECUTE_SILENT"
  | "EXECUTE_NOTIFY"
  | "CONFIRM"
  | "CLARIFY"
  | "REFUSE";

// ─── Risk Tier ────────────────────────────────────────────────────────────────

export type RiskTier = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

// ─── Conversation Turn ────────────────────────────────────────────────────────

export interface ConversationTurn {
  role: "user" | "alfred";
  content: string;
  timestamp?: string; // ISO string, optional
}

// ─── Pipeline Input ───────────────────────────────────────────────────────────

export interface DecisionRequest {
  proposedAction: string; // e.g. "Send email reply to Acme"
  latestMessage: string; // The most recent user message
  conversationHistory: ConversationTurn[]; // Full prior context, oldest first
  userContext?: {
    timezone?: string;
    prefersSilentExecution?: boolean;
    isFirstTimeUser?: boolean;
  };
  // Internal test flags — used to simulate failure modes from the UI
  simulateTimeout?: boolean;
  simulateMalformedOutput?: boolean;
}

// ─── Computed Signals ─────────────────────────────────────────────────────────

export interface ComputedSignals {
  // 0 = fully reversible, 1 = completely irreversible
  reversibilityScore: number;

  // 0 = completely unclear, 1 = fully resolved
  intentClarityScore: number;

  // Overall risk classification
  riskTier: RiskTier;

  // True if the latest message appears to contradict prior conversation history
  contextContradiction: boolean;

  // List of key parameters that appear unresolved
  missingParams: string[];

  // True if conversationHistory is empty or missing
  missingCriticalContext: boolean;

  // True if the action involves sending to external parties
  isExternalAction: boolean;

  // True if the action affects multiple items (bulk operations)
  isBulkAction: boolean;

  // True if a pre-filter rule short-circuited the pipeline (skipped LLM)
  preFilterTriggered: boolean;
  preFilterReason?: string;
}

// ─── LLM Response (raw parsed JSON from model) ───────────────────────────────

export interface LLMResponse {
  decision: DecisionOutcome;
  rationale: string; // 1–2 sentence explanation
  confidence: number; // 0.0–1.0
  flags: string[]; // e.g. ["contradiction_detected", "irreversible_action"]
}

// ─── Pipeline Step Trace ──────────────────────────────────────────────────────

export interface PipelineStep {
  name: string;
  status: "completed" | "short_circuited" | "skipped" | "failed";
  durationMs: number;
}

// ─── Final Pipeline Output ───────────────────────────────────────────────────

export interface DecisionResult {
  // Request tracking
  requestId: string;

  // The final decision (may come from pre-filter or LLM)
  decision: DecisionOutcome;
  rationale: string;
  confidence: number;
  flags: string[];

  // Full pipeline trace for the inspector UI
  trace: {
    input: DecisionRequest;
    signals: ComputedSignals;
    promptSent: string; // Exact prompt string sent to the model
    rawModelOutput: string; // Raw string response from the model
    parsedLLMResponse: LLMResponse | null;
    failureMode?: "timeout" | "malformed_output" | "missing_context" | null;
    fallbackApplied: boolean; // True if default safe behavior was used
    durationMs: number; // Total pipeline execution time
    pipelineSteps: PipelineStep[]; // Step-by-step trace for visualization
  };
}

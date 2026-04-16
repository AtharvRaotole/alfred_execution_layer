import { DecisionRequest, ComputedSignals } from "./types";

// ─── System Prompt ────────────────────────────────────────────────────────────
// This is the static instruction block sent as the system message.
// It defines alfred_'s decision framework for the LLM.

export const SYSTEM_PROMPT = `You are the Execution Decision Layer for alfred_, an AI assistant 
that acts on behalf of users via text messages.

Your job is to evaluate a proposed action and its full context, then return 
exactly ONE of these five decisions:

  EXECUTE_SILENT   — Act immediately, no notification needed. Use only for 
                     low-risk, reversible, fully-specified actions where the 
                     user has indicated they prefer silent execution.

  EXECUTE_NOTIFY   — Act immediately, but inform the user afterward. Use when 
                     intent is clear and risk is low-to-medium, but the user 
                     deserves a confirmation receipt.

  CONFIRM          — Ask the user to confirm before acting. Use when intent is 
                     resolved but the action is risky, irreversible, or involves 
                     external parties.

  CLARIFY          — Ask a targeted clarifying question. Use when intent, 
                     entity, or a key parameter is still unresolved. Do not act.

  REFUSE           — Decline to execute and optionally escalate. Use when policy 
                     disallows the action, or risk/uncertainty remains too high 
                     even after clarification would be possible.

CRITICAL RULES:
1. Never evaluate the latest message in isolation. Always reason over the full 
   conversation history.
2. If the conversation history contains a "hold off" or "wait" instruction that 
   has NOT been explicitly cleared, do not proceed silently.
3. Default toward safety. When uncertain between CONFIRM and EXECUTE, choose CONFIRM.
4. Irreversible bulk actions (mass delete, reply-all to external parties with 
   unreviewed content) should default to REFUSE unless the user has given 
   explicit, unambiguous approval in the current turn.
5. Respond ONLY with valid JSON matching the schema below. No extra text.

RESPONSE SCHEMA:
{
  "decision": "<one of the five outcomes above>",
  "rationale": "<1-2 sentences explaining the decision, referencing specific 
                 signals or history that drove it>",
  "confidence": <float between 0.0 and 1.0>,
  "flags": ["<optional signal labels that influenced the decision>"]
}

Valid flag values (use any that apply):
  "irreversible_action"
  "bulk_action"
  "external_recipients"
  "contradiction_detected"
  "missing_recipient"
  "missing_content"
  "missing_time_or_date"
  "low_intent_clarity"
  "prior_hold_off_uncleared"
  "first_time_user"
  "missing_critical_context"
  "high_risk_tier"
  "critical_risk_tier"
`;

// ─── Build User Message ───────────────────────────────────────────────────────
// Constructs the dynamic part of the prompt: signals + full context.
// This is exactly what gets sent to the model as the user message.

export function buildUserMessage(
  request: DecisionRequest,
  signals: ComputedSignals
): string {
  const { proposedAction, latestMessage, conversationHistory, userContext } = request;

  // Format conversation history as a readable transcript
  const historyBlock =
    conversationHistory.length > 0
      ? conversationHistory
          .map(
            (turn) =>
              `  [${turn.role.toUpperCase()}${
                turn.timestamp ? " @ " + turn.timestamp : ""
              }]: ${turn.content}`
          )
          .join("\n")
      : "  (no prior conversation history)";

  // Format user context block
  const userContextBlock = userContext
    ? [
        userContext.timezone ? `  Timezone: ${userContext.timezone}` : null,
        userContext.prefersSilentExecution !== undefined
          ? `  Prefers silent execution: ${userContext.prefersSilentExecution}`
          : null,
        userContext.isFirstTimeUser !== undefined
          ? `  First-time user: ${userContext.isFirstTimeUser}`
          : null,
      ]
        .filter(Boolean)
        .join("\n")
    : "  (no user context provided)";

  // Format computed signals block
  const signalsBlock = `
  reversibilityScore:      ${signals.reversibilityScore.toFixed(2)}  (0=reversible, 1=irreversible)
  intentClarityScore:      ${signals.intentClarityScore.toFixed(2)}  (0=unclear, 1=fully resolved)
  riskTier:                ${signals.riskTier}
  contextContradiction:    ${signals.contextContradiction}
  missingParams:           ${
    signals.missingParams.length > 0 ? signals.missingParams.join(", ") : "none"
  }
  missingCriticalContext:  ${signals.missingCriticalContext}
  isExternalAction:        ${signals.isExternalAction}
  isBulkAction:            ${signals.isBulkAction}`.trim();

  return `
## PROPOSED ACTION
${proposedAction}

## LATEST USER MESSAGE
"${latestMessage}"

## CONVERSATION HISTORY (oldest → newest)
${historyBlock}

## USER CONTEXT
${userContextBlock}

## PRE-COMPUTED SIGNALS
(These were computed deterministically by code before reaching you.
Use them as inputs to your reasoning — do not recompute them.)
${signalsBlock}

## YOUR TASK
Based on all of the above, return a JSON object with your decision,
rationale, confidence score, and any relevant flags.
Remember: evaluate the FULL conversation history, not just the latest message.
`.trim();
}

// ─── buildPrompt ──────────────────────────────────────────────────────────────
// Returns the final { systemPrompt, userMessage } pair ready for the API call.
// Also returns the full combined string for the trace inspector in the UI.

export function buildPrompt(
  request: DecisionRequest,
  signals: ComputedSignals
): {
  systemPrompt: string;
  userMessage: string;
  fullPromptTrace: string; // Human-readable combined version for UI display
} {
  const userMessage = buildUserMessage(request, signals);

  const fullPromptTrace = `=== SYSTEM PROMPT ===\n${SYSTEM_PROMPT}\n\n=== USER MESSAGE ===\n${userMessage}`;

  return {
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    fullPromptTrace,
  };
}

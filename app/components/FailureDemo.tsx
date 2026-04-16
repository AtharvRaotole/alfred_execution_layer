"use client";

import { DecisionRequest } from "@/app/lib/types";

interface FailureDemoProps {
  currentRequest: DecisionRequest | null;
  onTrigger: (request: DecisionRequest) => void;
  isLoading: boolean;
}

// ─── Failure mode definitions ─────────────────────────────────────────────────

const FAILURE_MODES = [
  {
    id: "timeout",
    label: "LLM Timeout",
    emoji: "⏱️",
    description:
      "Simulates the OpenAI API call exceeding the 8-second timeout. " +
      "The pipeline aborts and returns CONFIRM as the safe fallback.",
    flag: "simulateTimeout" as const,
    badgeColor: "bg-orange-100 text-orange-700 border-orange-200",
    what: "AbortController fires after 100ms, LLM call is cancelled",
    expect: "Decision: CONFIRM · fallbackApplied: true · failureMode: timeout",
  },
  {
    id: "malformed",
    label: "Malformed Model Output",
    emoji: "💥",
    description:
      "Simulates the model returning a prose response instead of JSON. " +
      "The parser fails validation and falls back to CONFIRM.",
    flag: "simulateMalformedOutput" as const,
    badgeColor: "bg-red-100 text-red-700 border-red-200",
    what: "Raw output is plain English prose — JSON.parse will throw",
    expect: "Decision: CONFIRM · fallbackApplied: true · failureMode: malformed_output",
  },
  {
    id: "missing-context",
    label: "Missing Critical Context",
    emoji: "🕳️",
    description:
      "Sends a vague action with zero conversation history. " +
      "The signal layer flags missingCriticalContext and intentClarityScore drops, " +
      "pushing the decision toward CLARIFY.",
    flag: null, // No special flag — this is a real request with empty history
    badgeColor: "bg-yellow-100 text-yellow-700 border-yellow-200",
    what: "conversationHistory: [], latestMessage is a bare pronoun",
    expect: "Decision: CLARIFY · missingCriticalContext: true · low intentClarityScore",
  },
];

// ─── Fixed request used for timeout + malformed demos ────────────────────────
// We reuse a simple, non-adversarial request so the failure is clearly
// coming from the pipeline mechanics, not the content.

const BASE_FAILURE_REQUEST: DecisionRequest = {
  proposedAction: "Send email reply to Acme Corp",
  latestMessage: "Send it",
  conversationHistory: [
    {
      role: "user",
      content: "Draft a reply to Acme confirming our meeting next Tuesday",
      timestamp: "2026-04-16T10:00:00Z",
    },
    {
      role: "alfred",
      content: "Done — draft is ready. Want me to send it?",
      timestamp: "2026-04-16T10:00:05Z",
    },
    {
      role: "user",
      content: "Send it",
      timestamp: "2026-04-16T10:01:00Z",
    },
  ],
};

// ─── Request for missing-context demo ────────────────────────────────────────

const MISSING_CONTEXT_REQUEST: DecisionRequest = {
  proposedAction: "Send email to unknown recipient",
  latestMessage: "Send it",
  conversationHistory: [], // Intentionally empty
  userContext: {
    isFirstTimeUser: true,
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function FailureDemo({
  currentRequest,
  onTrigger,
  isLoading,
}: FailureDemoProps) {
  const handleTrigger = (mode: (typeof FAILURE_MODES)[number]) => {
    if (isLoading) return;

    if (mode.id === "missing-context") {
      onTrigger(MISSING_CONTEXT_REQUEST);
      return;
    }

    // For timeout and malformed: use base request + inject the simulation flag
    const request: DecisionRequest = {
      ...BASE_FAILURE_REQUEST,
      simulateTimeout: mode.flag === "simulateTimeout" ? true : undefined,
      simulateMalformedOutput: mode.flag === "simulateMalformedOutput" ? true : undefined,
    };

    onTrigger(request);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Failure Mode Demos
        </div>
        <span
          className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 
                         border border-gray-200 rounded-full"
        >
          visible in inspector
        </span>
      </div>

      <div className="space-y-2">
        {FAILURE_MODES.map((mode) => (
          <div key={mode.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 bg-gray-50 
                            border-b border-gray-100"
            >
              <div className="flex items-center gap-2">
                <span>{mode.emoji}</span>
                <span className="text-sm font-semibold text-gray-700">{mode.label}</span>
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full border ${mode.badgeColor}`}
                >
                  {mode.id}
                </span>
              </div>
              <button
                onClick={() => handleTrigger(mode)}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-semibold bg-gray-900 text-white 
                           rounded-lg hover:bg-gray-700 disabled:opacity-40 
                           disabled:cursor-not-allowed transition-colors duration-150"
              >
                {isLoading ? "Running…" : "Trigger →"}
              </button>
            </div>

            {/* Body */}
            <div className="px-4 py-3 space-y-2">
              <p className="text-xs text-gray-500 leading-relaxed">{mode.description}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-gray-50 rounded border border-gray-100">
                  <div className="text-xs font-semibold text-gray-400 mb-1">What happens</div>
                  <div className="text-xs font-mono text-gray-600">{mode.what}</div>
                </div>
                <div className="p-2 bg-gray-50 rounded border border-gray-100">
                  <div className="text-xs font-semibold text-gray-400 mb-1">Expected output</div>
                  <div className="text-xs font-mono text-gray-600">{mode.expect}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Note about current request context */}
      {currentRequest && (
        <p className="mt-3 text-xs text-gray-400 italic">
          Note: Timeout and Malformed demos use a fixed base request regardless of what is loaded
          above. Missing Context always sends an empty history.
        </p>
      )}
    </div>
  );
}

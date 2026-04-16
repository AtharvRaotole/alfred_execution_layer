import { DecisionOutcome } from "@/app/lib/types";

interface DecisionBadgeProps {
  decision: DecisionOutcome;
  confidence: number;
  rationale: string;
  flags: string[];
  durationMs: number;
  fallbackApplied: boolean;
}

const DECISION_CONFIG: Record<
  DecisionOutcome,
  { label: string; bg: string; text: string; border: string; emoji: string; description: string }
> = {
  EXECUTE_SILENT: {
    label: "Execute Silently",
    bg: "bg-green-50",
    text: "text-green-800",
    border: "border-green-200",
    emoji: "✅",
    description: "Alfred will act immediately with no notification.",
  },
  EXECUTE_NOTIFY: {
    label: "Execute & Notify",
    bg: "bg-blue-50",
    text: "text-blue-800",
    border: "border-blue-200",
    emoji: "📬",
    description: "Alfred will act and send you a confirmation afterward.",
  },
  CONFIRM: {
    label: "Confirm First",
    bg: "bg-yellow-50",
    text: "text-yellow-800",
    border: "border-yellow-200",
    emoji: "⚠️",
    description: "Alfred needs your explicit approval before proceeding.",
  },
  CLARIFY: {
    label: "Needs Clarification",
    bg: "bg-orange-50",
    text: "text-orange-800",
    border: "border-orange-200",
    emoji: "❓",
    description: "Alfred will ask a follow-up question before acting.",
  },
  REFUSE: {
    label: "Refused",
    bg: "bg-red-50",
    text: "text-red-800",
    border: "border-red-200",
    emoji: "🚫",
    description: "Alfred will not execute this action.",
  },
};

export default function DecisionBadge({
  decision,
  confidence,
  rationale,
  flags,
  durationMs,
  fallbackApplied,
}: DecisionBadgeProps) {
  const config = DECISION_CONFIG[decision];

  return (
    <div className={`rounded-xl border-2 p-6 ${config.bg} ${config.border}`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{config.emoji}</span>
          <div>
            <div className={`text-xl font-bold ${config.text}`}>{config.label}</div>
            <div className="text-sm text-gray-500">{config.description}</div>
          </div>
        </div>
        {/* Confidence meter */}
        <div className="text-right">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">
            Confidence
          </div>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  confidence >= 0.7
                    ? "bg-green-500"
                    : confidence >= 0.4
                      ? "bg-yellow-500"
                      : "bg-red-400"
                }`}
                style={{ width: `${Math.round(confidence * 100)}%` }}
              />
            </div>
            <span className={`text-sm font-semibold ${config.text}`}>
              {Math.round(confidence * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Rationale */}
      <div className="mt-4 p-3 bg-white/60 rounded-lg border border-white">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
          Rationale
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">{rationale}</p>
      </div>

      {/* Flags row */}
      {flags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {flags.map((flag) => (
            <span
              key={flag}
              className="px-2 py-0.5 text-xs font-mono bg-white/70 border border-gray-200 
                         text-gray-600 rounded-full"
            >
              {flag}
            </span>
          ))}
        </div>
      )}

      {/* Footer meta */}
      <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
        <span>Pipeline completed in {durationMs}ms</span>
        {fallbackApplied && (
          <span className="px-2 py-0.5 bg-red-100 text-red-600 border border-red-200 
                           rounded-full font-medium"
          >
            ⚡ Fallback applied
          </span>
        )}
      </div>
    </div>
  );
}

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
  { label: string; bg: string; text: string; border: string; accent: string; description: string }
> = {
  EXECUTE_SILENT: {
    label: "Execute Silently",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    accent: "bg-emerald-500",
    description: "Alfred will act immediately with no notification.",
  },
  EXECUTE_NOTIFY: {
    label: "Execute & Notify",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    accent: "bg-blue-500",
    description: "Alfred will act and send you a confirmation afterward.",
  },
  CONFIRM: {
    label: "Confirm First",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    accent: "bg-amber-500",
    description: "Alfred needs your explicit approval before proceeding.",
  },
  CLARIFY: {
    label: "Needs Clarification",
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    accent: "bg-orange-500",
    description: "Alfred will ask a follow-up question before acting.",
  },
  REFUSE: {
    label: "Refused",
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    accent: "bg-rose-500",
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
    <div className={`rounded-xl border ${config.border} ${config.bg} overflow-hidden`}>
      {/* Top accent bar */}
      <div className={`h-1 ${config.accent}`} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className={`text-lg font-bold ${config.text}`}>{config.label}</div>
            <div className="text-[12px] text-slate-500 mt-0.5">{config.description}</div>
          </div>
          <div className="text-right shrink-0 ml-4">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Confidence
            </div>
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    confidence >= 0.7
                      ? "bg-emerald-500"
                      : confidence >= 0.4
                        ? "bg-amber-500"
                        : "bg-rose-400"
                  }`}
                  style={{ width: `${Math.round(confidence * 100)}%` }}
                />
              </div>
              <span className={`text-[13px] font-bold font-[family-name:var(--font-geist-mono)] ${config.text}`}>
                {Math.round(confidence * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Rationale */}
        <div className="p-3.5 bg-white/60 rounded-lg border border-white/80 mb-3">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Rationale
          </div>
          <p className="text-[13px] text-slate-600 leading-relaxed">{rationale}</p>
        </div>

        {/* Flags + meta */}
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1.5">
            {flags.map((flag) => (
              <span
                key={flag}
                className="px-2 py-0.5 text-[10px] font-[family-name:var(--font-geist-mono)] bg-white/70 border border-slate-200 text-slate-500 rounded-md"
              >
                {flag}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-3">
            <span className="text-[11px] font-[family-name:var(--font-geist-mono)] text-slate-400">{durationMs}ms</span>
            {fallbackApplied && (
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-rose-100 text-rose-600 border border-rose-200 rounded-md">
                fallback
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

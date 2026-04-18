"use client";

import { DecisionResult, DecisionOutcome } from "@/app/lib/types";

interface DecisionHistoryProps {
  history: Array<{ result: DecisionResult; timestamp: Date }>;
  onSelect: (result: DecisionResult) => void;
}

const DECISION_DOT: Record<DecisionOutcome, string> = {
  EXECUTE_SILENT: "bg-emerald-500",
  EXECUTE_NOTIFY: "bg-blue-500",
  CONFIRM: "bg-amber-500",
  CLARIFY: "bg-orange-500",
  REFUSE: "bg-rose-500",
};

export default function DecisionHistory({ history, onSelect }: DecisionHistoryProps) {
  if (history.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          History
        </div>
        <span className="text-[10px] font-[family-name:var(--font-geist-mono)] text-slate-400">{history.length}</span>
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {[...history].reverse().map((entry, i) => (
          <button
            key={i}
            onClick={() => onSelect(entry.result)}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors duration-150 group"
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${DECISION_DOT[entry.result.decision]}`} />
              <span className="text-[12px] font-medium text-slate-600 group-hover:text-slate-800">
                {entry.result.decision}
              </span>
              <span className="text-[10px] font-[family-name:var(--font-geist-mono)] text-slate-400 ml-auto">
                {Math.round(entry.result.confidence * 100)}% · {entry.result.trace.durationMs}ms
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate pl-4">
              {entry.result.trace.input.proposedAction}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

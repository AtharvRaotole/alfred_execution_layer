"use client";

import { useState } from "react";
import { DecisionRequest } from "@/app/lib/types";

interface FailureDemoProps {
  currentRequest: DecisionRequest | null;
  onTrigger: (request: DecisionRequest) => void;
  isLoading: boolean;
}

const FAILURE_MODES = [
  {
    id: "timeout",
    label: "LLM Timeout",
    description: "8-second timeout fires, pipeline falls back to CONFIRM.",
    flag: "simulateTimeout" as const,
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  {
    id: "malformed",
    label: "Malformed Output",
    description: "Model returns prose instead of JSON, parser falls back.",
    flag: "simulateMalformedOutput" as const,
    color: "text-rose-600 bg-rose-50 border-rose-200",
  },
  {
    id: "missing-context",
    label: "Missing Context",
    description: "Empty history + vague message pushes toward CLARIFY.",
    flag: null,
    color: "text-slate-600 bg-slate-50 border-slate-200",
  },
];

const BASE_FAILURE_REQUEST: DecisionRequest = {
  proposedAction: "Send email reply to Acme Corp",
  latestMessage: "Send it",
  conversationHistory: [
    { role: "user", content: "Draft a reply to Acme confirming our meeting next Tuesday", timestamp: "2026-04-16T10:00:00Z" },
    { role: "alfred", content: "Done — draft is ready. Want me to send it?", timestamp: "2026-04-16T10:00:05Z" },
    { role: "user", content: "Send it", timestamp: "2026-04-16T10:01:00Z" },
  ],
};

const MISSING_CONTEXT_REQUEST: DecisionRequest = {
  proposedAction: "Send email to unknown recipient",
  latestMessage: "Send it",
  conversationHistory: [],
  userContext: { isFirstTimeUser: true },
};

export default function FailureDemo({ currentRequest, onTrigger, isLoading }: FailureDemoProps) {
  const [expanded, setExpanded] = useState(false);

  const handleTrigger = (mode: (typeof FAILURE_MODES)[number]) => {
    if (isLoading) return;
    if (mode.id === "missing-context") {
      onTrigger(MISSING_CONTEXT_REQUEST);
      return;
    }
    const request: DecisionRequest = {
      ...BASE_FAILURE_REQUEST,
      simulateTimeout: mode.flag === "simulateTimeout" ? true : undefined,
      simulateMalformedOutput: mode.flag === "simulateMalformedOutput" ? true : undefined,
    };
    onTrigger(request);
  };

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between mb-3"
      >
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Failure Demos
        </div>
        <span className="text-[11px] text-slate-400">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="space-y-2">
          {FAILURE_MODES.map((mode) => (
            <div
              key={mode.id}
              className="flex items-center justify-between px-3.5 py-3 rounded-lg border border-slate-100 bg-slate-50/50"
            >
              <div className="min-w-0 mr-3">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[12px] font-semibold text-slate-700">{mode.label}</span>
                  <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded border ${mode.color}`}>
                    {mode.id}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{mode.description}</p>
              </div>
              <button
                onClick={() => handleTrigger(mode)}
                disabled={isLoading}
                className="shrink-0 px-3 py-1.5 text-[11px] font-semibold bg-slate-800 text-white 
                           rounded-lg hover:bg-slate-700 disabled:opacity-40 
                           disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? "…" : "Trigger"}
              </button>
            </div>
          ))}
        </div>
      )}

      {!expanded && (
        <div className="text-[11px] text-slate-400">
          3 demoable failure modes — click to expand
        </div>
      )}
    </div>
  );
}

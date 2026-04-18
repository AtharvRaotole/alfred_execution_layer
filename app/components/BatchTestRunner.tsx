"use client";

import { useState } from "react";
import { SCENARIOS, Scenario } from "@/app/lib/scenarios";
import { DecisionResult, DecisionOutcome } from "@/app/lib/types";

interface BatchResultEntry {
  scenario: Scenario;
  result: DecisionResult | null;
  error: string | null;
  loading: boolean;
}

const DECISION_COLORS: Record<DecisionOutcome, string> = {
  EXECUTE_SILENT: "bg-emerald-50 text-emerald-700 border-emerald-200",
  EXECUTE_NOTIFY: "bg-blue-50 text-blue-700 border-blue-200",
  CONFIRM: "bg-amber-50 text-amber-700 border-amber-200",
  CLARIFY: "bg-orange-50 text-orange-700 border-orange-200",
  REFUSE: "bg-rose-50 text-rose-700 border-rose-200",
};

const CAT_COLORS: Record<string, string> = {
  clear: "bg-emerald-50 text-emerald-600",
  ambiguous: "bg-amber-50 text-amber-600",
  adversarial: "bg-rose-50 text-rose-600",
};

export default function BatchTestRunner() {
  const [entries, setEntries] = useState<BatchResultEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);

  const runAll = async () => {
    setRunning(true);
    setCompleted(0);
    const initial: BatchResultEntry[] = SCENARIOS.map((s) => ({
      scenario: s, result: null, error: null, loading: true,
    }));
    setEntries(initial);

    for (let i = 0; i < SCENARIOS.length; i++) {
      const scenario = SCENARIOS[i];
      try {
        const res = await fetch("/api/decide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(scenario.request),
        });
        const data: DecisionResult = await res.json();
        setEntries((prev) => prev.map((e, idx) => idx === i ? { ...e, result: data, loading: false } : e));
      } catch (err) {
        setEntries((prev) => prev.map((e, idx) => idx === i ? { ...e, error: err instanceof Error ? err.message : "Failed", loading: false } : e));
      }
      setCompleted((c) => c + 1);
    }
    setRunning(false);
  };

  const totalMs = entries.reduce((sum, e) => sum + (e.result?.trace.durationMs ?? 0), 0);
  const avgConf = entries.filter((e) => e.result).length > 0
    ? Math.round((entries.reduce((s, e) => s + (e.result?.confidence ?? 0), 0) / entries.filter((e) => e.result).length) * 100)
    : 0;

  const decisionDistribution = entries.reduce((acc, e) => {
    if (e.result) acc[e.result.decision] = (acc[e.result.decision] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Batch Test Runner</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Run all {SCENARIOS.length} scenarios sequentially</p>
        </div>
        <button
          onClick={runAll}
          disabled={running}
          className="px-4 py-2 text-[12px] font-semibold bg-indigo-500 text-white rounded-lg 
                     hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {running ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              {completed}/{SCENARIOS.length}
            </span>
          ) : entries.length > 0 ? "Re-run All" : "Run All Scenarios"}
        </button>
      </div>

      {running && (
        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden mb-4">
          <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${(completed / SCENARIOS.length) * 100}%` }} />
        </div>
      )}

      {entries.length > 0 && !running && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Time</div>
            <div className="text-xl font-bold text-slate-800 mt-1 font-[family-name:var(--font-geist-mono)]">{totalMs}<span className="text-[11px] font-normal text-slate-400 ml-0.5">ms</span></div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Avg Confidence</div>
            <div className="text-xl font-bold text-slate-800 mt-1 font-[family-name:var(--font-geist-mono)]">{avgConf}<span className="text-[11px] font-normal text-slate-400 ml-0.5">%</span></div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Distribution</div>
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {Object.entries(decisionDistribution).map(([d, count]) => (
                <span key={d} className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${DECISION_COLORS[d as DecisionOutcome] ?? "bg-slate-100"}`}>
                  {d.replace("EXECUTE_", "E_")} x{count}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {entries.length > 0 && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Scenario</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-500">Category</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-500">Decision</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-500">Conf.</th>
                <th className="text-right px-4 py-2.5 font-semibold text-slate-500">Time</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.scenario.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 font-medium text-slate-700">{entry.scenario.label}</td>
                  <td className="px-3 py-2.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${CAT_COLORS[entry.scenario.category]}`}>
                      {entry.scenario.category}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {entry.loading ? (
                      <span className="text-slate-400 animate-pulse">running…</span>
                    ) : entry.error ? (
                      <span className="text-rose-500">error</span>
                    ) : entry.result ? (
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${DECISION_COLORS[entry.result.decision]}`}>
                        {entry.result.decision}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 font-[family-name:var(--font-geist-mono)] text-slate-600">
                    {entry.result ? `${Math.round(entry.result.confidence * 100)}%` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-[family-name:var(--font-geist-mono)] text-slate-400">
                    {entry.result ? `${entry.result.trace.durationMs}ms` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

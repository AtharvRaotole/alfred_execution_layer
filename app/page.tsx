"use client";

import { useState, useCallback, useEffect } from "react";
import { DecisionRequest, DecisionResult } from "@/app/lib/types";
import ScenarioSelector from "@/app/components/ScenarioSelector";
import DecisionBadge from "@/app/components/DecisionBadge";
import PipelineInspector from "@/app/components/PipelineInspector";
import FailureDemo from "@/app/components/FailureDemo";
import {
  PipelineStepperLoading,
  PipelineStepperComplete,
} from "@/app/components/PipelineStepper";
import BatchTestRunner from "@/app/components/BatchTestRunner";
import DecisionHistory from "@/app/components/DecisionHistory";
import ArchitectureDiagram from "@/app/components/ArchitectureDiagram";

const EMPTY_FORM = {
  proposedAction: "",
  latestMessage: "",
  historyRaw: "",
};

function parseHistory(raw: string): DecisionRequest["conversationHistory"] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) return { role: "user" as const, content: line };
      const role = line.slice(0, colonIdx).trim().toLowerCase();
      const content = line.slice(colonIdx + 1).trim();
      return {
        role: (role === "alfred" ? "alfred" : "user") as "user" | "alfred",
        content,
      };
    });
}

function serializeHistory(history: DecisionRequest["conversationHistory"]): string {
  return history.map((t) => `${t.role}: ${t.content}`).join("\n");
}

export default function Home() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedScenarioRequest, setSelectedScenarioRequest] = useState<DecisionRequest | null>(null);
  const [result, setResult] = useState<DecisionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"result" | "inspector" | "batch">("result");
  const [history, setHistory] = useState<Array<{ result: DecisionResult; timestamp: Date }>>([]);
  const [showArchitecture, setShowArchitecture] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        const btn = document.getElementById("submit-btn");
        if (btn && !btn.hasAttribute("disabled")) btn.click();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleScenarioSelect = (request: DecisionRequest) => {
    setSelectedScenarioRequest(request);
    setForm({
      proposedAction: request.proposedAction,
      latestMessage: request.latestMessage,
      historyRaw: serializeHistory(request.conversationHistory),
    });
    setResult(null);
    setError(null);
    setActiveTab("result");
  };

  const handleSubmit = useCallback(
    async (overrideRequest?: DecisionRequest) => {
      setIsLoading(true);
      setResult(null);
      setError(null);

      const request: DecisionRequest = overrideRequest ?? selectedScenarioRequest ?? {
        proposedAction: form.proposedAction,
        latestMessage: form.latestMessage,
        conversationHistory: parseHistory(form.historyRaw),
      };

      try {
        const res = await fetch("/api/decide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }

        const data: DecisionResult = await res.json();
        setResult(data);
        setHistory((prev) => [...prev, { result: data, timestamp: new Date() }]);
        setActiveTab("result");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    },
    [form, selectedScenarioRequest]
  );

  const handleHistorySelect = (r: DecisionResult) => {
    setResult(r);
    setActiveTab("result");
    setError(null);
  };

  const canSubmit =
    form.proposedAction.trim().length > 0 &&
    form.latestMessage.trim().length > 0 &&
    !isLoading;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[22px] font-bold tracking-tight text-slate-900">alfred<span className="text-indigo-500">_</span></span>
              <div className="hidden sm:flex items-center gap-2 ml-1">
                <span className="h-5 w-px bg-slate-200" />
                <span className="text-[13px] font-medium text-slate-500">Decision Layer</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowArchitecture(!showArchitecture)}
                className={`text-[13px] font-medium px-3.5 py-1.5 rounded-lg border transition-all duration-200 ${
                  showArchitecture
                    ? "bg-indigo-50 text-indigo-600 border-indigo-200"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
                }`}
              >
                {showArchitecture ? "Hide" : "Show"} Architecture
              </button>
              <div className="hidden md:flex items-center gap-2 text-[12px] text-slate-400 font-mono">
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">gpt-4o-mini</span>
                <span>·</span>
                <span>{history.length} decisions</span>
              </div>
            </div>
          </div>
        </div>
        {showArchitecture && (
          <div className="mx-auto max-w-[1400px] px-6 lg:px-8 pb-5 animate-fade-in">
            <ArchitectureDiagram />
          </div>
        )}
      </header>

      {/* ── Main ── */}
      <main className="mx-auto max-w-[1400px] px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ── LEFT SIDEBAR ── */}
          <div className="lg:col-span-4 xl:col-span-4 space-y-5">
            {/* Custom Input */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-4">Custom Input</div>
              <div className="space-y-3">
                <div>
                  <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Proposed Action</label>
                  <input
                    type="text"
                    value={form.proposedAction}
                    onChange={(e) => { setSelectedScenarioRequest(null); setForm((f) => ({ ...f, proposedAction: e.target.value })); }}
                    placeholder='e.g. "Send email reply to Acme Corp"'
                    className="w-full px-3.5 py-2.5 text-[13px] border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 placeholder-slate-300 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Latest User Message</label>
                  <input
                    type="text"
                    value={form.latestMessage}
                    onChange={(e) => { setSelectedScenarioRequest(null); setForm((f) => ({ ...f, latestMessage: e.target.value })); }}
                    placeholder='e.g. "Yep, send it"'
                    className="w-full px-3.5 py-2.5 text-[13px] border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 placeholder-slate-300 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-slate-600 mb-1.5">
                    Conversation History
                    <span className="font-normal text-slate-400 ml-1">(one turn per line)</span>
                  </label>
                  <textarea
                    value={form.historyRaw}
                    onChange={(e) => { setSelectedScenarioRequest(null); setForm((f) => ({ ...f, historyRaw: e.target.value })); }}
                    rows={4}
                    placeholder={"user: Draft a reply to Acme\nalfred: Done, want me to send it?"}
                    className="w-full px-3.5 py-2.5 text-[13px] border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 placeholder-slate-300 font-[family-name:var(--font-geist-mono)] resize-none transition-all"
                  />
                </div>
                <button
                  id="submit-btn"
                  onClick={() => handleSubmit()}
                  disabled={!canSubmit}
                  className="w-full py-2.5 text-[13px] font-semibold bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Running pipeline…
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Run Decision Pipeline
                      <kbd className="text-[10px] font-mono opacity-50 bg-indigo-400/30 px-1.5 py-0.5 rounded">⌘↵</kbd>
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Scenarios */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <ScenarioSelector onSelect={handleScenarioSelect} />
            </div>

            {/* Decision History */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <DecisionHistory history={history} onSelect={handleHistorySelect} />
              {history.length === 0 && (
                <div className="text-[12px] text-slate-400 text-center py-6">
                  <div className="text-slate-300 text-2xl mb-2">○</div>
                  No decisions yet
                </div>
              )}
            </div>

            {/* Failure Demos */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <FailureDemo currentRequest={null} onTrigger={handleSubmit} isLoading={isLoading} />
            </div>
          </div>

          {/* ── RIGHT CONTENT ── */}
          <div className="lg:col-span-8 xl:col-span-8 space-y-5">
            {/* Empty state */}
            {!result && !error && !isLoading && (
              <div className="space-y-5 animate-fade-in">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-8 py-16 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-5">
                      <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-1.5">No decision yet</h3>
                    <p className="text-[13px] text-slate-400 max-w-md leading-relaxed">
                      Select a preloaded scenario from the left panel, fill in a custom input, or trigger a failure demo to run the pipeline.
                    </p>
                    <div className="mt-6 flex items-center gap-2">
                      <kbd className="px-2 py-1 text-[11px] font-mono bg-slate-100 text-slate-500 rounded-md border border-slate-200">⌘</kbd>
                      <span className="text-[11px] text-slate-400">+</span>
                      <kbd className="px-2 py-1 text-[11px] font-mono bg-slate-100 text-slate-500 rounded-md border border-slate-200">Enter</kbd>
                      <span className="text-[11px] text-slate-400 ml-1">to submit</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                  <BatchTestRunner />
                </div>
              </div>
            )}

            {/* Loading state */}
            {isLoading && (
              <div className="animate-fade-in">
                <PipelineStepperLoading />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm animate-fade-in">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-red-700 mb-0.5">Request Failed</div>
                    <p className="text-[12px] text-red-600 font-[family-name:var(--font-geist-mono)]">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Result */}
            {result && !isLoading && (
              <div className="space-y-5 animate-fade-in">
                {/* Pipeline steps bar */}
                {result.trace.pipelineSteps && (
                  <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pipeline</span>
                      <span className="text-[11px] font-[family-name:var(--font-geist-mono)] text-slate-400">{result.requestId?.slice(0, 8)}</span>
                    </div>
                    <PipelineStepperComplete steps={result.trace.pipelineSteps} />
                  </div>
                )}

                {/* Decision badge */}
                <DecisionBadge
                  decision={result.decision}
                  confidence={result.confidence}
                  rationale={result.rationale}
                  flags={result.flags}
                  durationMs={result.trace.durationMs}
                  fallbackApplied={result.trace.fallbackApplied}
                />

                {/* Tabs */}
                <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
                  {([["result", "Overview"], ["inspector", "Inspector"], ["batch", "Batch Test"]] as const).map(([tab, label]) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-1.5 text-[12px] font-medium rounded-md transition-all duration-150 ${
                        activeTab === tab
                          ? "bg-white text-slate-800 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                {activeTab === "result" && (
                  <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-4">Input Summary</div>
                    <div className="space-y-4">
                      <div>
                        <div className="text-[11px] font-medium text-slate-400 mb-1.5">Proposed Action</div>
                        <div className="text-[13px] font-medium text-slate-700 bg-slate-50 rounded-lg px-4 py-2.5 border border-slate-100">
                          {result.trace.input.proposedAction}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-slate-400 mb-1.5">Latest Message</div>
                        <div className="text-[13px] text-slate-700 bg-slate-50 rounded-lg px-4 py-2.5 border border-slate-100 italic">
                          &ldquo;{result.trace.input.latestMessage}&rdquo;
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-slate-400 mb-1.5">
                          Conversation History ({result.trace.input.conversationHistory.length} turns)
                        </div>
                        {result.trace.input.conversationHistory.length === 0 ? (
                          <div className="text-[12px] text-amber-600 italic px-4 py-2.5 bg-amber-50 border border-amber-100 rounded-lg">
                            No history provided — missingCriticalContext flag set
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {result.trace.input.conversationHistory.map((turn, i) => (
                              <div key={i} className={`flex gap-3 px-4 py-2.5 rounded-lg text-[12px] border ${
                                turn.role === "alfred"
                                  ? "bg-indigo-50/50 border-indigo-100"
                                  : "bg-slate-50 border-slate-100"
                              }`}>
                                <span className={`font-semibold shrink-0 ${
                                  turn.role === "alfred" ? "text-indigo-500" : "text-slate-500"
                                }`}>
                                  {turn.role === "alfred" ? "alfred_" : "user"}
                                </span>
                                <span className="text-slate-600">{turn.content}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "inspector" && <PipelineInspector result={result} />}

                {activeTab === "batch" && (
                  <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <BatchTestRunner />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200/60 mt-12">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-8 py-5 flex items-center justify-between">
          <span className="text-[12px] text-slate-400">alfred_ Decision Layer</span>
          <div className="flex items-center gap-4 text-[11px] text-slate-400 font-[family-name:var(--font-geist-mono)]">
            <span>Next.js 16</span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span>gpt-4o-mini</span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span>TypeScript</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

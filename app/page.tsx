"use client";

import { useState } from "react";
import { DecisionRequest, DecisionResult } from "@/app/lib/types";
import ScenarioSelector from "@/app/components/ScenarioSelector";
import DecisionBadge from "@/app/components/DecisionBadge";
import PipelineInspector from "@/app/components/PipelineInspector";
import FailureDemo from "@/app/components/FailureDemo";

// ─── Default empty form state ─────────────────────────────────────────────────

const EMPTY_FORM = {
  proposedAction: "",
  latestMessage: "",
  historyRaw: "", // textarea: one turn per line as "role: content"
};

// ─── Parse raw history textarea into ConversationTurn[] ──────────────────────

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

// ─── Serialize a loaded scenario's history back to textarea format ────────────

function serializeHistory(history: DecisionRequest["conversationHistory"]): string {
  return history.map((t) => `${t.role}: ${t.content}`).join("\n");
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [result, setResult] = useState<DecisionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"result" | "inspector">("result");

  // ── Load a scenario into the form ──────────────────────────────────────────
  const handleScenarioSelect = (request: DecisionRequest) => {
    setForm({
      proposedAction: request.proposedAction,
      latestMessage: request.latestMessage,
      historyRaw: serializeHistory(request.conversationHistory),
    });
    setResult(null);
    setError(null);
    setActiveTab("result");
  };

  // ── Submit the form (or a pre-built request from FailureDemo) ──────────────
  const handleSubmit = async (overrideRequest?: DecisionRequest) => {
    setIsLoading(true);
    setResult(null);
    setError(null);

    const request: DecisionRequest =
      overrideRequest ?? {
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
      setActiveTab("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit =
    form.proposedAction.trim().length > 0 && form.latestMessage.trim().length > 0 && !isLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-gray-900 tracking-tight">alfred_</span>
              <span
                className="px-2 py-0.5 text-xs font-medium bg-gray-900 text-white 
                               rounded-full"
              >
                Decision Layer
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Execution Decision Layer · Prototype
            </p>
          </div>
          <div className="text-xs text-gray-400 text-right">
            <div>gpt-4o-mini · hybrid signal + LLM pipeline</div>
            <div>5 outcomes · 3 failure modes · 6 scenarios</div>
          </div>
        </div>
      </header>

      {/* ── Main layout ────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── LEFT COLUMN: Input + Scenarios + Failure Demos ─────────────── */}
        <div className="lg:col-span-1 space-y-6">
          {/* Input form */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Custom Input
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Proposed Action
              </label>
              <input
                type="text"
                value={form.proposedAction}
                onChange={(e) => setForm((f) => ({ ...f, proposedAction: e.target.value }))}
                placeholder='e.g. "Send email reply to Acme Corp"'
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg 
                           bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 
                           focus:border-transparent placeholder-gray-300"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Latest User Message
              </label>
              <input
                type="text"
                value={form.latestMessage}
                onChange={(e) => setForm((f) => ({ ...f, latestMessage: e.target.value }))}
                placeholder='e.g. "Yep, send it"'
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg 
                           bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 
                           focus:border-transparent placeholder-gray-300"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Conversation History
                <span className="font-normal text-gray-400 ml-1">
                  (one turn per line: <code className="text-gray-500">user: …</code> or{" "}
                  <code className="text-gray-500">alfred: …</code>)
                </span>
              </label>
              <textarea
                value={form.historyRaw}
                onChange={(e) => setForm((f) => ({ ...f, historyRaw: e.target.value }))}
                rows={5}
                placeholder={
                  "user: Draft a reply to Acme\nalfred: Done, want me to send it?\nuser: Hold off until legal reviews\nalfred: Understood\nuser: Yep, send it"
                }
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg 
                           bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 
                           focus:border-transparent placeholder-gray-300 font-mono 
                           resize-none"
              />
            </div>

            <button
              onClick={() => handleSubmit()}
              disabled={!canSubmit}
              className="w-full py-2.5 text-sm font-semibold bg-gray-900 text-white 
                         rounded-lg hover:bg-gray-700 disabled:opacity-40 
                         disabled:cursor-not-allowed transition-colors duration-150"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  Running pipeline…
                </span>
              ) : (
                "Run Decision Pipeline →"
              )}
            </button>
          </div>

          {/* Scenario selector */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <ScenarioSelector onSelect={handleScenarioSelect} />
          </div>

          {/* Failure demos */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <FailureDemo currentRequest={null} onTrigger={handleSubmit} isLoading={isLoading} />
          </div>
        </div>

        {/* ── RIGHT COLUMN: Result + Inspector ───────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Empty state */}
          {!result && !error && !isLoading && (
            <div
              className="bg-white rounded-xl border border-gray-200 p-16 
                            flex flex-col items-center justify-center text-center"
            >
              <div className="text-4xl mb-4">🧠</div>
              <div className="text-sm font-semibold text-gray-600 mb-2">No decision yet</div>
              <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
                Select a preloaded scenario from the left, fill in the custom input form, or
                trigger a failure demo to run the pipeline.
              </p>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div
              className="bg-white rounded-xl border border-gray-200 p-16 
                            flex flex-col items-center justify-center text-center"
            >
              <div className="text-4xl mb-4 animate-pulse">⚙️</div>
              <div className="text-sm font-semibold text-gray-600 mb-2">Pipeline running…</div>
              <p className="text-xs text-gray-400">
                Computing signals → building prompt → calling model → parsing output
              </p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="bg-red-50 rounded-xl border border-red-200 p-6">
              <div className="text-sm font-semibold text-red-700 mb-1">⚠️ Request failed</div>
              <p className="text-xs text-red-600 font-mono">{error}</p>
            </div>
          )}

          {/* Result */}
          {result && !isLoading && (
            <>
              {/* Decision badge */}
              <DecisionBadge
                decision={result.decision}
                confidence={result.confidence}
                rationale={result.rationale}
                flags={result.flags}
                durationMs={result.trace.durationMs}
                fallbackApplied={result.trace.fallbackApplied}
              />

              {/* Tab bar */}
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
                <button
                  onClick={() => setActiveTab("result")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md 
                              transition-colors duration-150 ${
                                activeTab === "result"
                                  ? "bg-white text-gray-900 shadow-sm"
                                  : "text-gray-500 hover:text-gray-700"
                              }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab("inspector")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md 
                              transition-colors duration-150 ${
                                activeTab === "inspector"
                                  ? "bg-white text-gray-900 shadow-sm"
                                  : "text-gray-500 hover:text-gray-700"
                              }`}
                >
                  Pipeline Inspector 🔍
                </button>
              </div>

              {/* Overview tab */}
              {activeTab === "result" && (
                <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Input Summary
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Proposed Action</div>
                      <div
                        className="text-sm font-medium text-gray-800 bg-gray-50 
                                      rounded-lg px-3 py-2 border border-gray-100"
                      >
                        {result.trace.input.proposedAction}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Latest Message</div>
                      <div
                        className="text-sm text-gray-800 bg-gray-50 rounded-lg 
                                      px-3 py-2 border border-gray-100 italic"
                      >
                        "{result.trace.input.latestMessage}"
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">
                        Conversation History
                        <span className="ml-1 font-normal">
                          ({result.trace.input.conversationHistory.length} turns)
                        </span>
                      </div>
                      {result.trace.input.conversationHistory.length === 0 ? (
                        <div
                          className="text-xs text-gray-400 italic px-3 py-2 
                                        bg-yellow-50 border border-yellow-100 rounded-lg"
                        >
                          No history provided — missingCriticalContext flag set
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {result.trace.input.conversationHistory.map((turn, i) => (
                            <div
                              key={i}
                              className={`flex gap-2 px-3 py-2 rounded-lg text-xs border ${
                                turn.role === "alfred"
                                  ? "bg-blue-50 border-blue-100"
                                  : "bg-gray-50 border-gray-100"
                              }`}
                            >
                              <span
                                className={`font-semibold shrink-0 ${
                                  turn.role === "alfred" ? "text-blue-600" : "text-gray-500"
                                }`}
                              >
                                {turn.role === "alfred" ? "alfred_" : "user"}
                              </span>
                              <span className="text-gray-700">{turn.content}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Inspector tab */}
              {activeTab === "inspector" && <PipelineInspector result={result} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

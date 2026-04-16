"use client";

import { useState } from "react";
import { DecisionResult } from "@/app/lib/types";

interface PipelineInspectorProps {
  result: DecisionResult;
}

// ─── Collapsible section wrapper ─────────────────────────────────────────────

function InspectorSection({
  title,
  badge,
  badgeColor,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: string;
  badgeColor?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 
                   hover:bg-gray-100 transition-colors duration-150 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">{title}</span>
          {badge && (
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full border ${
                badgeColor ?? "bg-gray-100 text-gray-500 border-gray-200"
              }`}
            >
              {badge}
            </span>
          )}
        </div>
        <span className="text-gray-400 text-sm">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-4 py-4 bg-white border-t border-gray-100">{children}</div>
      )}
    </div>
  );
}

// ─── Code block ──────────────────────────────────────────────────────────────

function CodeBlock({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 
                   hover:bg-gray-600 text-gray-200 rounded transition-colors"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
      <pre
        className="text-xs font-mono bg-gray-900 text-gray-100 rounded-lg 
                      p-4 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed"
      >
        {content}
      </pre>
    </div>
  );
}

// ─── Signal row ───────────────────────────────────────────────────────────────

function SignalRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number | boolean | string[];
  highlight?: "warn" | "danger" | "good";
}) {
  const colorMap = {
    warn: "text-yellow-700 font-semibold",
    danger: "text-red-700 font-semibold",
    good: "text-green-700 font-semibold",
  };

  const displayValue = Array.isArray(value)
    ? value.length > 0
      ? value.join(", ")
      : "none"
    : String(value);

  return (
    <div
      className="flex items-start justify-between py-1.5 border-b border-gray-50 
                    last:border-0"
    >
      <span className="text-xs font-mono text-gray-500 w-48 shrink-0">{label}</span>
      <span
        className={`text-xs font-mono text-right ${
          highlight ? colorMap[highlight] : "text-gray-800"
        }`}
      >
        {displayValue}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PipelineInspector({ result }: PipelineInspectorProps) {
  const { trace } = result;
  const { signals } = trace;

  // Determine signal highlight levels
  const reversibilityHighlight =
    signals.reversibilityScore >= 0.8
      ? "danger"
      : signals.reversibilityScore >= 0.5
        ? "warn"
        : "good";

  const clarityHighlight =
    signals.intentClarityScore < 0.4
      ? "danger"
      : signals.intentClarityScore < 0.7
        ? "warn"
        : "good";

  const riskHighlight =
    signals.riskTier === "CRITICAL" || signals.riskTier === "HIGH"
      ? "danger"
      : signals.riskTier === "MEDIUM"
        ? "warn"
        : "good";

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Pipeline Inspector
      </div>

      {/* ── 1. Input ── */}
      <InspectorSection
        title="1 · Input"
        badge="raw request"
        badgeColor="bg-gray-100 text-gray-500 border-gray-200"
      >
        <CodeBlock content={JSON.stringify(trace.input, null, 2)} />
      </InspectorSection>

      {/* ── 2. Computed Signals ── */}
      <InspectorSection
        title="2 · Computed Signals"
        badge={signals.preFilterTriggered ? "pre-filter triggered" : "passed to LLM"}
        badgeColor={
          signals.preFilterTriggered
            ? "bg-orange-100 text-orange-700 border-orange-200"
            : "bg-blue-100 text-blue-700 border-blue-200"
        }
        defaultOpen={true}
      >
        <div className="mb-3">
          <SignalRow
            label="reversibilityScore"
            value={signals.reversibilityScore.toFixed(2)}
            highlight={reversibilityHighlight}
          />
          <SignalRow
            label="intentClarityScore"
            value={signals.intentClarityScore.toFixed(2)}
            highlight={clarityHighlight}
          />
          <SignalRow label="riskTier" value={signals.riskTier} highlight={riskHighlight} />
          <SignalRow
            label="contextContradiction"
            value={signals.contextContradiction}
            highlight={signals.contextContradiction ? "danger" : undefined}
          />
          <SignalRow
            label="missingParams"
            value={signals.missingParams}
            highlight={signals.missingParams.length > 0 ? "warn" : undefined}
          />
          <SignalRow
            label="missingCriticalContext"
            value={signals.missingCriticalContext}
            highlight={signals.missingCriticalContext ? "warn" : undefined}
          />
          <SignalRow
            label="isExternalAction"
            value={signals.isExternalAction}
            highlight={signals.isExternalAction ? "warn" : undefined}
          />
          <SignalRow
            label="isBulkAction"
            value={signals.isBulkAction}
            highlight={signals.isBulkAction ? "danger" : undefined}
          />
          <SignalRow
            label="preFilterTriggered"
            value={signals.preFilterTriggered}
            highlight={signals.preFilterTriggered ? "warn" : undefined}
          />
          {signals.preFilterReason && (
            <div
              className="mt-2 p-2 bg-orange-50 border border-orange-100 rounded text-xs 
                            text-orange-700"
            >
              <span className="font-semibold">Pre-filter reason: </span>
              {signals.preFilterReason}
            </div>
          )}
        </div>
      </InspectorSection>

      {/* ── 3. Prompt Sent ── */}
      <InspectorSection
        title="3 · Prompt Sent to Model"
        badge="exact prompt"
        badgeColor="bg-purple-100 text-purple-700 border-purple-200"
      >
        <CodeBlock content={trace.promptSent} />
      </InspectorSection>

      {/* ── 4. Raw Model Output ── */}
      <InspectorSection
        title="4 · Raw Model Output"
        badge={trace.failureMode ? `failure: ${trace.failureMode}` : "raw response"}
        badgeColor={
          trace.failureMode
            ? "bg-red-100 text-red-700 border-red-200"
            : "bg-green-100 text-green-700 border-green-200"
        }
      >
        {trace.fallbackApplied && (
          <div className="mb-3 p-2 bg-red-50 border border-red-100 rounded text-xs text-red-700">
            <span className="font-semibold">⚡ Fallback applied</span> — the raw output
            below could not be parsed. The final decision was produced by the safe
            default fallback, not the model.
          </div>
        )}
        <CodeBlock content={trace.rawModelOutput} />
      </InspectorSection>

      {/* ── 5. Parsed LLM Response ── */}
      <InspectorSection
        title="5 · Parsed LLM Response"
        badge={trace.parsedLLMResponse ? "valid" : "fallback"}
        badgeColor={
          trace.parsedLLMResponse
            ? "bg-green-100 text-green-700 border-green-200"
            : "bg-red-100 text-red-700 border-red-200"
        }
      >
        {trace.parsedLLMResponse ? (
          <CodeBlock content={JSON.stringify(trace.parsedLLMResponse, null, 2)} />
        ) : (
          <div className="text-xs text-gray-500 italic">
            No valid parsed response — fallback was used. See Raw Model Output above.
          </div>
        )}
      </InspectorSection>
    </div>
  );
}

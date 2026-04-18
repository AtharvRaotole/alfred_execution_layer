"use client";

import { useState } from "react";
import { DecisionResult } from "@/app/lib/types";

interface PipelineInspectorProps {
  result: DecisionResult;
}

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
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/50 
                   hover:bg-slate-50 transition-colors duration-150 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-slate-700">{title}</span>
          {badge && (
            <span className={`px-2 py-0.5 text-[10px] font-medium rounded-md border ${badgeColor ?? "bg-slate-100 text-slate-500 border-slate-200"}`}>
              {badge}
            </span>
          )}
        </div>
        <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 py-4 bg-white border-t border-slate-100">{children}</div>
      )}
    </div>
  );
}

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
        className="absolute top-2.5 right-2.5 px-2 py-1 text-[10px] font-medium bg-slate-700 
                   hover:bg-slate-600 text-slate-300 rounded-md transition-colors"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
      <pre className="text-[12px] font-[family-name:var(--font-geist-mono)] bg-slate-900 text-slate-200 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
        {content}
      </pre>
    </div>
  );
}

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
    warn: "text-amber-600 font-semibold",
    danger: "text-rose-600 font-semibold",
    good: "text-emerald-600 font-semibold",
  };

  const displayValue = Array.isArray(value) ? (value.length > 0 ? value.join(", ") : "none") : String(value);

  return (
    <div className="flex items-start justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-[12px] font-[family-name:var(--font-geist-mono)] text-slate-500 w-48 shrink-0">{label}</span>
      <span className={`text-[12px] font-[family-name:var(--font-geist-mono)] text-right ${highlight ? colorMap[highlight] : "text-slate-800"}`}>
        {displayValue}
      </span>
    </div>
  );
}

export default function PipelineInspector({ result }: PipelineInspectorProps) {
  const { trace } = result;
  const { signals } = trace;

  const reversibilityHighlight = signals.reversibilityScore >= 0.8 ? "danger" : signals.reversibilityScore >= 0.5 ? "warn" : "good";
  const clarityHighlight = signals.intentClarityScore < 0.4 ? "danger" : signals.intentClarityScore < 0.7 ? "warn" : "good";
  const riskHighlight = signals.riskTier === "CRITICAL" || signals.riskTier === "HIGH" ? "danger" : signals.riskTier === "MEDIUM" ? "warn" : "good";

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Pipeline Inspector</div>

      <InspectorSection title="1 · Input" badge="raw request" badgeColor="bg-slate-100 text-slate-500 border-slate-200">
        <CodeBlock content={JSON.stringify(trace.input, null, 2)} />
      </InspectorSection>

      <InspectorSection
        title="2 · Computed Signals"
        badge={signals.preFilterTriggered ? "pre-filter triggered" : "passed to LLM"}
        badgeColor={signals.preFilterTriggered ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-indigo-50 text-indigo-600 border-indigo-200"}
        defaultOpen={true}
      >
        <div className="mb-3">
          <SignalRow label="reversibilityScore" value={signals.reversibilityScore.toFixed(2)} highlight={reversibilityHighlight} />
          <SignalRow label="intentClarityScore" value={signals.intentClarityScore.toFixed(2)} highlight={clarityHighlight} />
          <SignalRow label="riskTier" value={signals.riskTier} highlight={riskHighlight} />
          <SignalRow label="contextContradiction" value={signals.contextContradiction} highlight={signals.contextContradiction ? "danger" : undefined} />
          <SignalRow label="missingParams" value={signals.missingParams} highlight={signals.missingParams.length > 0 ? "warn" : undefined} />
          <SignalRow label="missingCriticalContext" value={signals.missingCriticalContext} highlight={signals.missingCriticalContext ? "warn" : undefined} />
          <SignalRow label="isExternalAction" value={signals.isExternalAction} highlight={signals.isExternalAction ? "warn" : undefined} />
          <SignalRow label="isBulkAction" value={signals.isBulkAction} highlight={signals.isBulkAction ? "danger" : undefined} />
          <SignalRow label="preFilterTriggered" value={signals.preFilterTriggered} highlight={signals.preFilterTriggered ? "warn" : undefined} />
          {signals.preFilterReason && (
            <div className="mt-2 p-2.5 bg-amber-50 border border-amber-100 rounded-lg text-[12px] text-amber-700">
              <span className="font-semibold">Pre-filter reason: </span>{signals.preFilterReason}
            </div>
          )}
        </div>
      </InspectorSection>

      <InspectorSection title="3 · Prompt Sent to Model" badge="exact prompt" badgeColor="bg-violet-50 text-violet-600 border-violet-200">
        <CodeBlock content={trace.promptSent} />
      </InspectorSection>

      <InspectorSection
        title="4 · Raw Model Output"
        badge={trace.failureMode ? `failure: ${trace.failureMode}` : "raw response"}
        badgeColor={trace.failureMode ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-emerald-50 text-emerald-600 border-emerald-200"}
      >
        {trace.fallbackApplied && (
          <div className="mb-3 p-2.5 bg-rose-50 border border-rose-100 rounded-lg text-[12px] text-rose-700">
            <span className="font-semibold">Fallback applied</span> — the raw output below could not be parsed. The final decision was produced by the safe default fallback.
          </div>
        )}
        <CodeBlock content={trace.rawModelOutput} />
      </InspectorSection>

      <InspectorSection
        title="5 · Parsed LLM Response"
        badge={trace.parsedLLMResponse ? "valid" : "fallback"}
        badgeColor={trace.parsedLLMResponse ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-rose-50 text-rose-600 border-rose-200"}
      >
        {trace.parsedLLMResponse ? (
          <CodeBlock content={JSON.stringify(trace.parsedLLMResponse, null, 2)} />
        ) : (
          <div className="text-[12px] text-slate-500 italic">
            No valid parsed response — fallback was used.
          </div>
        )}
      </InspectorSection>
    </div>
  );
}

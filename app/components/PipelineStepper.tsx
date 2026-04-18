"use client";

import { useEffect, useState } from "react";
import { PipelineStep } from "@/app/lib/types";

const STEP_LABELS: Record<string, { label: string; description: string }> = {
  parse_input: { label: "Parse Input", description: "Validating and sanitizing request" },
  compute_signals: { label: "Signals", description: "Running deterministic extraction" },
  pre_filter: { label: "Pre-Filter", description: "Checking short-circuit rules" },
  build_prompt: { label: "Build Prompt", description: "Assembling prompt with signals" },
  llm_call: { label: "LLM Call", description: "Calling gpt-4o-mini" },
  parse_output: { label: "Parse", description: "Validating JSON response" },
};

const STEP_ORDER = ["parse_input", "compute_signals", "pre_filter", "build_prompt", "llm_call", "parse_output"];

export function PipelineStepperLoading() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timings = [300, 400, 300, 500, 2000, 500];
    let elapsed = 0;
    const timers: NodeJS.Timeout[] = [];
    for (let i = 0; i < STEP_ORDER.length; i++) {
      elapsed += timings[i];
      timers.push(setTimeout(() => setActiveStep(i + 1), elapsed));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pipeline Running</span>
      </div>
      <div className="space-y-0">
        {STEP_ORDER.map((stepName, idx) => {
          const info = STEP_LABELS[stepName];
          const isActive = idx === activeStep;
          const isDone = idx < activeStep;
          const isPending = idx > activeStep;

          return (
            <div key={stepName} className="flex items-stretch gap-3">
              <div className="flex flex-col items-center w-6">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold
                    transition-all duration-500 ${
                      isDone
                        ? "bg-emerald-100 text-emerald-600"
                        : isActive
                          ? "bg-indigo-100 text-indigo-600 ring-2 ring-indigo-200 ring-offset-1 scale-110"
                          : "bg-slate-100 text-slate-400"
                    }`}
                >
                  {isDone ? "✓" : isActive ? "●" : idx + 1}
                </div>
                {idx < STEP_ORDER.length - 1 && (
                  <div className={`w-px flex-1 min-h-[20px] transition-colors duration-500 ${isDone ? "bg-emerald-200" : "bg-slate-100"}`} />
                )}
              </div>
              <div className={`pb-4 transition-opacity duration-300 ${isPending ? "opacity-40" : ""}`}>
                <span className={`text-[13px] font-medium ${isActive ? "text-indigo-600" : isDone ? "text-slate-700" : "text-slate-400"}`}>
                  {info.label}
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">{info.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PipelineStepperComplete({ steps }: { steps: PipelineStep[] }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {steps.map((step, idx) => {
        const info = STEP_LABELS[step.name] ?? { label: step.name };
        const colorMap = {
          completed: "bg-emerald-50 text-emerald-600 border-emerald-200",
          short_circuited: "bg-amber-50 text-amber-600 border-amber-200",
          skipped: "bg-slate-50 text-slate-400 border-slate-200",
          failed: "bg-rose-50 text-rose-600 border-rose-200",
        };
        return (
          <div key={step.name} className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border ${colorMap[step.status]}`}
              title={`${info.label}: ${step.status}`}
            >
              {info.label}
            </span>
            {idx < steps.length - 1 && (
              <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}

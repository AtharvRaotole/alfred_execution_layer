"use client";

const STEPS = [
  { label: "Input", sub: "Payload", color: "from-slate-100 to-slate-50", border: "border-slate-200", text: "text-slate-600" },
  { label: "Signals", sub: "Deterministic", color: "from-indigo-50 to-indigo-100", border: "border-indigo-200", text: "text-indigo-600" },
  { label: "Pre-Filter", sub: "Short-circuit", color: "from-amber-50 to-amber-100", border: "border-amber-200", text: "text-amber-600" },
  { label: "Prompt", sub: "Builder", color: "from-violet-50 to-violet-100", border: "border-violet-200", text: "text-violet-600" },
  { label: "gpt-4o-mini", sub: "JSON mode", color: "from-emerald-50 to-emerald-100", border: "border-emerald-300", text: "text-emerald-700", highlight: true },
  { label: "Parser", sub: "Validate", color: "from-sky-50 to-sky-100", border: "border-sky-200", text: "text-sky-600" },
  { label: "Decision", sub: "Output", color: "from-slate-800 to-slate-900", border: "border-slate-700", text: "text-white", dark: true },
];

export default function ArchitectureDiagram() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-6 py-5">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {STEPS.map((step, idx) => (
          <div key={step.label} className="flex items-center gap-2 shrink-0">
            <div
              className={`w-[90px] h-14 rounded-lg bg-gradient-to-br ${step.color} border ${step.border} 
                          flex flex-col items-center justify-center ${step.highlight ? "ring-1 ring-emerald-200 shadow-sm" : ""}`}
            >
              <span className={`text-[11px] font-bold ${step.text}`}>{step.label}</span>
              <span className={`text-[9px] ${step.dark ? "text-slate-400" : "text-slate-400"} mt-0.5`}>{step.sub}</span>
            </div>
            {idx < STEPS.length - 1 && (
              <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { SCENARIOS, Scenario } from "@/app/lib/scenarios";
import { DecisionRequest } from "@/app/lib/types";

interface ScenarioSelectorProps {
  onSelect: (request: DecisionRequest) => void;
}

const CATEGORY_CONFIG = {
  clear: { label: "Clear", color: "text-emerald-600", dot: "bg-emerald-500" },
  ambiguous: { label: "Ambiguous", color: "text-amber-600", dot: "bg-amber-500" },
  adversarial: { label: "Adversarial", color: "text-rose-600", dot: "bg-rose-500" },
};

export default function ScenarioSelector({ onSelect }: ScenarioSelectorProps) {
  const grouped = {
    clear: SCENARIOS.filter((s) => s.category === "clear"),
    ambiguous: SCENARIOS.filter((s) => s.category === "ambiguous"),
    adversarial: SCENARIOS.filter((s) => s.category === "adversarial"),
  };

  return (
    <div>
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-4">
        Preloaded Scenarios
      </div>
      <div className="space-y-4">
        {(["clear", "ambiguous", "adversarial"] as const).map((cat) => (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-1.5 h-1.5 rounded-full ${CATEGORY_CONFIG[cat].dot}`} />
              <span className={`text-[11px] font-semibold ${CATEGORY_CONFIG[cat].color}`}>
                {CATEGORY_CONFIG[cat].label}
              </span>
              <span className="text-[10px] text-slate-300 font-mono">{grouped[cat].length}</span>
            </div>
            <div className="space-y-1.5">
              {grouped[cat].map((scenario: Scenario) => (
                <button
                  key={scenario.id}
                  onClick={() => onSelect(scenario.request)}
                  className="w-full text-left px-3.5 py-2.5 rounded-lg border border-slate-100 
                             bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200
                             transition-all duration-150 group"
                >
                  <span className="text-[13px] font-medium text-slate-700 group-hover:text-slate-900">
                    {scenario.label}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed line-clamp-1">
                    {scenario.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

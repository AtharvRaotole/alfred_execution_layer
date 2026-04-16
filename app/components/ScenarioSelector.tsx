"use client";

import { SCENARIOS, Scenario } from "@/app/lib/scenarios";
import { DecisionRequest } from "@/app/lib/types";

interface ScenarioSelectorProps {
  onSelect: (request: DecisionRequest) => void;
}

const CATEGORY_CONFIG = {
  clear: { label: "Clear", color: "text-green-600", dot: "bg-green-400" },
  ambiguous: { label: "Ambiguous", color: "text-yellow-600", dot: "bg-yellow-400" },
  adversarial: { label: "Adversarial", color: "text-red-600", dot: "bg-red-400" },
};

export default function ScenarioSelector({ onSelect }: ScenarioSelectorProps) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Preloaded Scenarios
      </div>
      <div className="grid grid-cols-1 gap-2">
        {SCENARIOS.map((scenario: Scenario) => {
          const cat = CATEGORY_CONFIG[scenario.category];
          return (
            <button
              key={scenario.id}
              onClick={() => onSelect(scenario.request)}
              className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 
                         bg-white hover:bg-gray-50 hover:border-gray-300 
                         transition-all duration-150 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800 group-hover:text-black">
                  {scenario.label}
                </span>
                <span className={`flex items-center gap-1.5 text-xs font-medium ${cat.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
                  {cat.label}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                {scenario.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

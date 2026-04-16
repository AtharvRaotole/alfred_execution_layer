import { LLMResponse, DecisionOutcome } from "./types";

// ─── Valid decision outcomes ──────────────────────────────────────────────────

const VALID_DECISIONS: DecisionOutcome[] = [
  "EXECUTE_SILENT",
  "EXECUTE_NOTIFY",
  "CONFIRM",
  "CLARIFY",
  "REFUSE",
];

// ─── Safe fallback response ───────────────────────────────────────────────────
// Used whenever parsing fails or output is malformed.
// We default to CONFIRM — the safest non-destructive fallback.

export function buildFallbackResponse(reason: string): LLMResponse {
  return {
    decision: "CONFIRM",
    rationale: `Fallback applied: ${reason}. Defaulting to CONFIRM to avoid unintended execution.`,
    confidence: 0.0,
    flags: ["fallback_applied"],
  };
}

// ─── extractJSON ──────────────────────────────────────────────────────────────
// Attempts to extract a JSON object from a raw string.
// Handles cases where the model wraps JSON in markdown code fences.

function extractJSON(raw: string): string {
  const trimmed = raw.trim();

  // Case 1: already clean JSON
  if (trimmed.startsWith("{")) return trimmed;

  // Case 2: wrapped in ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Case 3: JSON somewhere inside prose — find first { to last }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  // No JSON found
  return "";
}

// ─── validateLLMResponse ─────────────────────────────────────────────────────
// Validates that a parsed object matches the LLMResponse schema.
// Returns an array of validation error strings (empty = valid).

function validateLLMResponse(obj: unknown): string[] {
  const errors: string[] = [];

  if (typeof obj !== "object" || obj === null) {
    errors.push("Response is not an object");
    return errors;
  }

  const r = obj as Record<string, unknown>;

  // decision: required, must be one of the valid outcomes
  if (!r.decision) {
    errors.push("Missing field: decision");
  } else if (!VALID_DECISIONS.includes(r.decision as DecisionOutcome)) {
    errors.push(
      `Invalid decision value: "${r.decision}". Must be one of: ${VALID_DECISIONS.join(", ")}`
    );
  }

  // rationale: required, must be a non-empty string
  if (!r.rationale) {
    errors.push("Missing field: rationale");
  } else if (typeof r.rationale !== "string" || r.rationale.trim().length === 0) {
    errors.push("Field rationale must be a non-empty string");
  }

  // confidence: required, must be a number between 0 and 1
  if (r.confidence === undefined || r.confidence === null) {
    errors.push("Missing field: confidence");
  } else if (typeof r.confidence !== "number") {
    errors.push("Field confidence must be a number");
  } else if (r.confidence < 0 || r.confidence > 1) {
    errors.push(`Field confidence must be between 0.0 and 1.0, got: ${r.confidence}`);
  }

  // flags: required, must be an array of strings (can be empty)
  if (!Array.isArray(r.flags)) {
    errors.push("Field flags must be an array");
  } else if (!r.flags.every((f) => typeof f === "string")) {
    errors.push("All items in flags must be strings");
  }

  return errors;
}

// ─── parseDecision ────────────────────────────────────────────────────────────
// Main parser. Takes the raw string output from the LLM and returns either:
//   - A valid LLMResponse, or
//   - A fallback LLMResponse with failure metadata
//
// Also returns:
//   - validationErrors: list of schema errors found (empty if clean)
//   - parseFailure: true if we had to use the fallback

export function parseDecision(rawOutput: string): {
  result: LLMResponse;
  validationErrors: string[];
  parseFailure: boolean;
} {
  // Step 1: handle empty or whitespace-only output
  if (!rawOutput || rawOutput.trim().length === 0) {
    return {
      result: buildFallbackResponse("Model returned empty output"),
      validationErrors: ["Raw output was empty"],
      parseFailure: true,
    };
  }

  // Step 2: extract JSON string from raw output
  const jsonString = extractJSON(rawOutput);
  if (!jsonString) {
    return {
      result: buildFallbackResponse("Could not locate JSON in model output"),
      validationErrors: ["No JSON object found in raw output"],
      parseFailure: true,
    };
  }

  // Step 3: parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      result: buildFallbackResponse(`JSON.parse failed: ${message}`),
      validationErrors: [`JSON parse error: ${message}`],
      parseFailure: true,
    };
  }

  // Step 4: validate schema
  const validationErrors = validateLLMResponse(parsed);
  if (validationErrors.length > 0) {
    return {
      result: buildFallbackResponse(
        `Schema validation failed: ${validationErrors.join("; ")}`
      ),
      validationErrors,
      parseFailure: true,
    };
  }

  // Step 5: safe cast — we know shape is valid at this point
  const r = parsed as Record<string, unknown>;

  // Clamp confidence to [0, 1] as a final safety measure
  const confidence = Math.max(0, Math.min(1, r.confidence as number));

  return {
    result: {
      decision: r.decision as DecisionOutcome,
      rationale: (r.rationale as string).trim(),
      confidence,
      flags: r.flags as string[],
    },
    validationErrors: [],
    parseFailure: false,
  };
}

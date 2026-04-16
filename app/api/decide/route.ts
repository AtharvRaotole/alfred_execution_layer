import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { DecisionRequest, DecisionResult, ComputedSignals } from "@/app/lib/types";
import { computeSignals } from "@/app/lib/signals";
import { buildPrompt } from "@/app/lib/prompt-builder";
import { parseDecision, buildFallbackResponse } from "@/app/lib/decision-parser";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ─── POST /api/decide ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  // ── Step 1: Parse and validate request body ──────────────────────────────
  let request: DecisionRequest;
  try {
    request = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }

  if (!request.proposedAction || !request.latestMessage) {
    return NextResponse.json(
      { error: "proposedAction and latestMessage are required" },
      { status: 400 }
    );
  }

  if (!Array.isArray(request.conversationHistory)) {
    request.conversationHistory = [];
  }

  // ── Step 2: Compute deterministic signals ────────────────────────────────
  const signals: ComputedSignals = computeSignals(request);

  // ── Step 3: Pre-filter short-circuit ────────────────────────────────────
  // If a pre-filter rule triggered, skip the LLM entirely.
  if (signals.preFilterTriggered) {
    const preFilterDecision = signals.riskTier === "CRITICAL" ? "REFUSE" : "CLARIFY";

    const result: DecisionResult = {
      decision: preFilterDecision,
      rationale: signals.preFilterReason ?? "Pre-filter rule triggered.",
      confidence: 0.95,
      flags: [
        signals.riskTier === "CRITICAL" ? "critical_risk_tier" : "low_intent_clarity",
        "pre_filter_triggered",
      ],
      trace: {
        input: request,
        signals,
        promptSent: "(skipped — pre-filter rule short-circuited pipeline before LLM call)",
        rawModelOutput: "(skipped — no LLM call made)",
        parsedLLMResponse: null,
        failureMode: null,
        fallbackApplied: false,
        durationMs: Date.now() - startTime,
      },
    };

    return NextResponse.json(result);
  }

  // ── Step 4: Build prompt ─────────────────────────────────────────────────
  const { systemPrompt, userMessage, fullPromptTrace } = buildPrompt(request, signals);

  // ── Step 5: Simulate failure modes (test flags) ──────────────────────────
  if (request.simulateMalformedOutput) {
    const fallback = buildFallbackResponse(
      "Simulated malformed output: model returned non-JSON prose"
    );
    const result: DecisionResult = {
      decision: fallback.decision,
      rationale: fallback.rationale,
      confidence: fallback.confidence,
      flags: fallback.flags,
      trace: {
        input: request,
        signals,
        promptSent: fullPromptTrace,
        rawModelOutput:
          "Sure! I think you should probably confirm this action because it seems risky. Let me know if you need help!",
        parsedLLMResponse: null,
        failureMode: "malformed_output",
        fallbackApplied: true,
        durationMs: Date.now() - startTime,
      },
    };
    return NextResponse.json(result);
  }

  // ── Step 6: Call OpenAI with timeout ────────────────────────────────────
  let rawModelOutput = "";

  try {
    // Simulate timeout if flag is set
    if (request.simulateTimeout) {
      await new Promise((_, reject) => setTimeout(() => reject(new Error("AbortError")), 100));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const response = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        temperature: 0.1, // Low temperature for consistent, deterministic decisions
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      },
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);
    rawModelOutput = response.choices[0]?.message?.content ?? "";
  } catch (err) {
    const isTimeout =
      err instanceof Error &&
      (err.name === "AbortError" || err.message.includes("AbortError"));

    const fallback = buildFallbackResponse(
      isTimeout
        ? "LLM call timed out after 8 seconds"
        : `LLM call failed: ${err instanceof Error ? err.message : String(err)}`
    );

    const result: DecisionResult = {
      decision: fallback.decision,
      rationale: fallback.rationale,
      confidence: fallback.confidence,
      flags: fallback.flags,
      trace: {
        input: request,
        signals,
        promptSent: fullPromptTrace,
        rawModelOutput: "(no output — API call did not complete)",
        parsedLLMResponse: null,
        failureMode: isTimeout ? "timeout" : "malformed_output",
        fallbackApplied: true,
        durationMs: Date.now() - startTime,
      },
    };

    return NextResponse.json(result);
  }

  // ── Step 7: Parse and validate LLM output ───────────────────────────────
  const { result: parsedLLMResponse, parseFailure, validationErrors } =
    parseDecision(rawModelOutput);

  // ── Step 8: Assemble final DecisionResult ────────────────────────────────
  const result: DecisionResult = {
    decision: parsedLLMResponse.decision,
    rationale: parsedLLMResponse.rationale,
    confidence: parsedLLMResponse.confidence,
    flags: parsedLLMResponse.flags,
    trace: {
      input: request,
      signals,
      promptSent: fullPromptTrace,
      rawModelOutput,
      parsedLLMResponse: parseFailure ? null : parsedLLMResponse,
      failureMode: parseFailure ? "malformed_output" : null,
      fallbackApplied: parseFailure,
      durationMs: Date.now() - startTime,
    },
  };

  // Log validation errors server-side if any
  if (validationErrors.length > 0) {
    console.warn("[decide] Parse validation errors:", validationErrors);
  }

  return NextResponse.json(result);
}

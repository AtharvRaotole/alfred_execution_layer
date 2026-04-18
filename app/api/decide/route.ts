import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { DecisionRequest, DecisionResult, ComputedSignals } from "@/app/lib/types";
import { computeSignals } from "@/app/lib/signals";
import { buildPrompt } from "@/app/lib/prompt-builder";
import { parseDecision, buildFallbackResponse } from "@/app/lib/decision-parser";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ─── Input constraints ────────────────────────────────────────────────────────
const MAX_ACTION_LENGTH = 500;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_TURNS = 50;
const MAX_TURN_CONTENT_LENGTH = 2000;

// ─── Simple in-memory rate limiter (per-IP, sliding window) ───────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 requests per minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

// ─── Sanitize user strings to prevent prompt injection patterns ───────────────
function sanitizeInput(str: string): string {
  return str
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // strip control chars
    .trim();
}

// ─── POST /api/decide ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  // ── Rate limiting ────────────────────────────────────────────────────────
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(clientIp)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 30 requests per minute." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // ── Step 1: Parse and validate request body ──────────────────────────────
  let request: DecisionRequest;
  try {
    const rawBody = await req.text();
    if (rawBody.length > 100_000) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 });
    }
    request = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }

  if (!request.proposedAction || !request.latestMessage) {
    return NextResponse.json(
      { error: "proposedAction and latestMessage are required" },
      { status: 400 }
    );
  }

  // ── Input length validation ──────────────────────────────────────────────
  if (typeof request.proposedAction !== "string" || typeof request.latestMessage !== "string") {
    return NextResponse.json({ error: "proposedAction and latestMessage must be strings" }, { status: 400 });
  }
  if (request.proposedAction.length > MAX_ACTION_LENGTH) {
    return NextResponse.json({ error: `proposedAction exceeds ${MAX_ACTION_LENGTH} chars` }, { status: 400 });
  }
  if (request.latestMessage.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `latestMessage exceeds ${MAX_MESSAGE_LENGTH} chars` }, { status: 400 });
  }

  // ── Sanitize inputs ─────────────────────────────────────────────────────
  request.proposedAction = sanitizeInput(request.proposedAction);
  request.latestMessage = sanitizeInput(request.latestMessage);

  if (!Array.isArray(request.conversationHistory)) {
    request.conversationHistory = [];
  }

  // ── Validate and sanitize conversation history ──────────────────────────
  if (request.conversationHistory.length > MAX_HISTORY_TURNS) {
    request.conversationHistory = request.conversationHistory.slice(-MAX_HISTORY_TURNS);
  }
  request.conversationHistory = request.conversationHistory
    .filter(turn => turn && typeof turn.content === "string" && typeof turn.role === "string")
    .map(turn => ({
      ...turn,
      role: (turn.role === "alfred" ? "alfred" : "user") as "user" | "alfred",
      content: sanitizeInput(turn.content).slice(0, MAX_TURN_CONTENT_LENGTH),
    }));

  // ── Step 2: Compute deterministic signals ────────────────────────────────
  const signals: ComputedSignals = computeSignals(request);

  // ── Step 3: Pre-filter short-circuit ────────────────────────────────────
  // If a pre-filter rule triggered, skip the LLM entirely.
  if (signals.preFilterTriggered) {
    const preFilterDecision = signals.riskTier === "CRITICAL" ? "REFUSE" : "CLARIFY";

    const result: DecisionResult = {
      requestId,
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
        pipelineSteps: [
          { name: "parse_input", status: "completed", durationMs: 0 },
          { name: "compute_signals", status: "completed", durationMs: 0 },
          { name: "pre_filter", status: "short_circuited", durationMs: 0 },
          { name: "build_prompt", status: "skipped", durationMs: 0 },
          { name: "llm_call", status: "skipped", durationMs: 0 },
          { name: "parse_output", status: "skipped", durationMs: 0 },
        ],
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
      requestId,
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
        pipelineSteps: [
          { name: "parse_input", status: "completed", durationMs: 0 },
          { name: "compute_signals", status: "completed", durationMs: 0 },
          { name: "pre_filter", status: "completed", durationMs: 0 },
          { name: "build_prompt", status: "completed", durationMs: 0 },
          { name: "llm_call", status: "completed", durationMs: 0 },
          { name: "parse_output", status: "failed", durationMs: 0 },
        ],
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
        : `LLM call failed: ${err instanceof Error ? err.name : "unknown"}`
    );

    const result: DecisionResult = {
      requestId,
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
        pipelineSteps: [
          { name: "parse_input", status: "completed", durationMs: 0 },
          { name: "compute_signals", status: "completed", durationMs: 0 },
          { name: "pre_filter", status: "completed", durationMs: 0 },
          { name: "build_prompt", status: "completed", durationMs: 0 },
          { name: "llm_call", status: "failed", durationMs: Date.now() - startTime },
          { name: "parse_output", status: "skipped", durationMs: 0 },
        ],
      },
    };

    return NextResponse.json(result);
  }

  // ── Step 7: Parse and validate LLM output ───────────────────────────────
  const { result: parsedLLMResponse, parseFailure, validationErrors } =
    parseDecision(rawModelOutput);

  // ── Step 8: Assemble final DecisionResult ────────────────────────────────
  const result: DecisionResult = {
    requestId,
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
      pipelineSteps: [
        { name: "parse_input", status: "completed", durationMs: 0 },
        { name: "compute_signals", status: "completed", durationMs: 0 },
        { name: "pre_filter", status: "completed", durationMs: 0 },
        { name: "build_prompt", status: "completed", durationMs: 0 },
        { name: "llm_call", status: "completed", durationMs: Date.now() - startTime },
        { name: "parse_output", status: parseFailure ? "failed" : "completed", durationMs: 0 },
      ],
    },
  };

  // Log validation errors server-side if any
  if (validationErrors.length > 0) {
    console.warn("[decide] Parse validation errors:", validationErrors);
  }

  return NextResponse.json(result);
}

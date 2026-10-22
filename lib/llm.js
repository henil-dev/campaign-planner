// Thin wrapper over the Gemini REST API. No SDK, so swapping providers means changing this file only.
// GEMINI_BASE_URL is only for pointing tests at a local stub.
const base = () => process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 60000;
const FALLBACK_MODEL = 'gemini-flash-latest';

export class LlmError extends Error {
  constructor(message, { status, retryable = false } = {}) {
    super(message);
    this.status = status;
    this.retryable = retryable;
  }
}

export const llmConfigured = () => Boolean(process.env.GEMINI_API_KEY);
export const modelName = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash';

async function call(model, { system, turns, schema }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base()}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.error?.message || `HTTP ${res.status}`;
      throw new LlmError(`Gemini API error: ${msg}`, { status: res.status, retryable: res.status === 429 || res.status >= 500 });
    }

    const cand = body.candidates?.[0];
    const text = cand?.content?.parts?.map((p) => p.text || '').join('') || '';
    if (!text) {
      const why = cand?.finishReason || body.promptFeedback?.blockReason || 'empty response';
      throw new LlmError(`Gemini returned no text (${why}).`, { retryable: true });
    }
    return {
      text,
      model,
      finishReason: cand.finishReason,
      tokensIn: body.usageMetadata?.promptTokenCount ?? 0,
      tokensOut: (body.usageMetadata?.candidatesTokenCount ?? 0) + (body.usageMetadata?.thoughtsTokenCount ?? 0),
    };
  } catch (err) {
    if (err.name === 'AbortError') throw new LlmError(`Gemini did not answer within ${TIMEOUT_MS / 1000}s.`, { retryable: true });
    if (err instanceof LlmError) throw err;
    throw new LlmError(`Could not reach Gemini: ${err.message}`, { retryable: true });
  } finally {
    clearTimeout(timer);
  }
}

// One retry on transient errors; if the configured model doesn't exist, try the "latest" alias once.
export async function generateJson(req) {
  let model = modelName();
  for (let attempt = 1; ; attempt++) {
    try {
      return await call(model, req);
    } catch (err) {
      if (err.status === 404 && model !== FALLBACK_MODEL) { model = FALLBACK_MODEL; continue; }
      if (err.retryable && attempt < 2) { await new Promise((r) => setTimeout(r, 1500)); continue; }
      throw err;
    }
  }
}

// Adapter for lib/planner.js.
export const gemini = {
  name: modelName(),
  get configured() { return llmConfigured(); },
  missingNote: 'GEMINI_API_KEY is not set on the server, so the AI step was skipped.',
  generate: generateJson,
};

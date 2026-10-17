// Runs one request through the pipeline: prompt -> Gemini -> parse.
import { CHANNEL_KEYS } from './channels.js';
import { generateJson, llmConfigured, modelName, LlmError } from './llm.js';
import { SYSTEM_PROMPT, buildSchema, buildUserPrompt } from './prompt.js';

const clean = (s, max = 600) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '');

export function parseModelJson(text) {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
  try {
    return JSON.parse(stripped);
  } catch {
    throw new LlmError('Gemini returned text that is not valid JSON.', { retryable: true });
  }
}

// Keep only what the UI knows how to show, and drop anything for channels we don't support.
export function shapeOutput(raw) {
  const known = (k) => CHANNEL_KEYS.includes(k);
  return {
    channels: Array.isArray(raw.channels)
      ? raw.channels.filter((c) => known(c.channel)).map((c) => ({ channel: c.channel, why: clean(c.why, 300) }))
      : null,
    positioning: {
      oneLiner: clean(raw.positioning?.oneLiner, 200),
      audienceInsight: clean(raw.positioning?.audienceInsight, 300),
    },
    ideas: (raw.ideas || []).slice(0, 3).map((i) => ({
      name: clean(i.name, 80),
      concept: clean(i.concept, 400),
      whyItFits: clean(i.whyItFits, 300),
      bestOn: known(i.bestOn) ? i.bestOn : null,
    })),
    ads: (raw.ads || []).filter((a) => known(a.channel)).map((a) => ({
      channel: a.channel,
      variants: (a.variants || []).slice(0, 2).map((v, i) => ({
        label: i === 0 ? 'A' : 'B',
        angle: clean(v.angle, 80),
        headline: clean(v.headline, 200),
        body: clean(v.body, 800),
        cta: clean(v.cta, 40),
      })),
    })),
    tests: (raw.tests || []).slice(0, 3).map((t) => ({
      channel: known(t.channel) ? t.channel : null,
      variable: clean(t.variable, 30),
      hypothesis: clean(t.hypothesis, 300),
      variantA: clean(t.variantA, 200),
      variantB: clean(t.variantB, 200),
      metric: clean(t.metric, 30),
    })),
    assumptions: (raw.assumptions || []).slice(0, 4).map((a) => clean(a, 250)).filter(Boolean),
  };
}

export async function runPlan(input) {
  const started = Date.now();
  const meta = { model: modelName(), tokensIn: 0, tokensOut: 0, latencyMs: 0, error: null };

  if (!llmConfigured()) {
    meta.error = 'GEMINI_API_KEY is not set, so the AI step was skipped.';
    return { status: 'no_key', input, ai: null, meta };
  }

  try {
    const res = await generateJson({
      system: SYSTEM_PROMPT,
      turns: [{ role: 'user', text: buildUserPrompt(input) }],
      schema: buildSchema({ chooseChannels: true }),
    });
    meta.model = res.model;
    meta.tokensIn = res.tokensIn;
    meta.tokensOut = res.tokensOut;
    const ai = shapeOutput(parseModelJson(res.text));
    return { status: 'complete', input, ai, meta: { ...meta, latencyMs: Date.now() - started } };
  } catch (err) {
    meta.error = err.message;
    return { status: 'ai_error', input, ai: null, meta: { ...meta, latencyMs: Date.now() - started } };
  }
}

// Runs one request through the pipeline:
// channel rules -> prompt -> model -> parse -> copy checks (one retry) -> test sizing -> readiness score.
// No Node-only imports, so the same file runs on the server and in the browser (Claude page).
import { SYSTEM_PROMPT, buildSchema, buildUserPrompt } from './prompt.js';
import { planChannels } from './logic/channelPlan.js';
import { checkCopy, needsRetry, retryMessage } from './logic/copyCheck.js';
import { sizeTests, fallbackTests } from './logic/testPlan.js';
import { readiness } from './logic/readiness.js';

const clean = (s, max = 600) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '');

export function parseModelJson(text) {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
  try {
    return JSON.parse(stripped);
  } catch {
    // Some models add a sentence around the JSON; take the outermost object.
    const a = stripped.indexOf('{');
    const b = stripped.lastIndexOf('}');
    if (a !== -1 && b > a) {
      try { return JSON.parse(stripped.slice(a, b + 1)); } catch { /* fall through */ }
    }
    throw new Error('The model returned text that is not valid JSON.');
  }
}

// Keep only what the UI knows how to show, and only the channels the rules picked.
export function shapeOutput(raw, allowed) {
  const known = (k) => allowed.includes(k);
  return {
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
      channel: known(t.channel) ? t.channel : allowed[0],
      variable: clean(t.variable, 30),
      hypothesis: clean(t.hypothesis, 300),
      variantA: clean(t.variantA, 200),
      variantB: clean(t.variantB, 200),
      metric: clean(t.metric, 30),
    })),
    assumptions: (raw.assumptions || []).slice(0, 4).map((a) => clean(a, 250)).filter(Boolean),
  };
}

// llm is the model adapter: { name, configured, missingNote, generate({ system, turns, schema }) }
// returning { text, model, tokensIn, tokensOut }. The server passes Gemini (lib/llm.js); the
// Claude page passes Claude (claude/api.js).
export async function runPlan(input, llm) {
  const started = Date.now();
  const meta = { model: llm.name, tokensIn: 0, tokensOut: 0, latencyMs: 0, retried: false, error: null, issuesBeforeRetry: 0 };

  // 1. Rules: channels, budget, forecast. Always runs, even if the AI step fails.
  const channelPlan = planChannels(input);
  const allowed = channelPlan.channels.map((c) => c.key);

  let ai = null;
  let issues = [];
  let status = 'complete';

  if (!llm.configured) {
    status = 'no_key';
    meta.error = llm.missingNote;
  } else {
    try {
      // 2. Model writes copy for the chosen channels only.
      const userPrompt = buildUserPrompt(input, { channels: channelPlan.channels });
      const schema = buildSchema({ chooseChannels: false });
      const first = await llm.generate({ system: SYSTEM_PROMPT, turns: [{ role: 'user', text: userPrompt }], schema });
      meta.model = first.model;
      meta.tokensIn += first.tokensIn;
      meta.tokensOut += first.tokensOut;
      ai = shapeOutput(parseModelJson(first.text), allowed);

      // 3. Check the copy; if it breaks hard rules, give the model one chance to fix it.
      issues = checkCopy(ai, channelPlan.channels, input);
      if (needsRetry(issues)) {
        meta.retried = true;
        meta.issuesBeforeRetry = issues.length;
        try {
          const second = await llm.generate({
            system: SYSTEM_PROMPT,
            turns: [
              { role: 'user', text: userPrompt },
              { role: 'model', text: first.text },
              { role: 'user', text: retryMessage(issues) },
            ],
            schema,
          });
          meta.tokensIn += second.tokensIn;
          meta.tokensOut += second.tokensOut;
          const fixed = shapeOutput(parseModelJson(second.text), allowed);
          const fixedIssues = checkCopy(fixed, channelPlan.channels, input);
          // Keep whichever version has fewer problems.
          if (fixedIssues.length <= issues.length) { ai = fixed; issues = fixedIssues; }
        } catch {
          // The first answer is still usable; its issues stay flagged.
        }
      }
    } catch (err) {
      status = 'ai_error';
      meta.error = err.message;
      ai = null;
      issues = [];
    }
  }

  // 4. Size the tests against the traffic each channel's budget buys.
  const rawTests = ai?.tests?.length ? ai.tests : fallbackTests(channelPlan.channels);
  const tests = sizeTests(rawTests, channelPlan.channels, input.weeks);

  // 5. Score.
  const score = readiness({ channelPlan, issues, tests, aiOk: Boolean(ai) });

  meta.latencyMs = Date.now() - started;
  return { status, input, channelPlan, ai, issues, tests, readiness: score, meta };
}

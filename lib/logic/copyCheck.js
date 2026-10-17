// Checks the copy the model wrote. Errors trigger one retry; anything left is shown on the ad.
import { CHANNELS } from '../channels.js';

const FILLER = [
  'unlock', 'unleash', 'elevate', 'seamless', 'seamlessly', 'revolutionize', 'revolutionise', 'game-changer', 'game changer',
  'empower', 'leverage', 'cutting-edge', 'next-level', 'supercharge', 'transform your', 'look no further',
  'fast-paced', 'world-class', 'one-stop', 'effortless', 'effortlessly', 'in today\'s', 'like never before', 'take it to the next',
];

// [pattern, label, categories where this is an error rather than a warning]
const RISKY = [
  [/\bguarantee(d|s)?\b/i, 'promises a guarantee', ['finance', 'health', 'education']],
  [/\b100\s?%/i, 'claims 100%', ['finance', 'health']],
  [/(#\s?1\b|\bnumber one\b|\bno\.? ?1\b)/i, 'claims to be #1', []],
  [/\b(the )?best (in|of) (india|the world|town|class)\b/i, 'claims to be the best', []],
  [/\b(cures?|heals?|reverses?)\b/i, 'medical claim', ['health']],
  [/\bclinically (proven|tested)\b/i, 'clinical claim', ['health']],
  [/\bno side[- ]effects?\b/i, 'claims no side effects', ['health']],
  [/\b(risk[- ]free|assured returns?|guaranteed returns?|double your money)\b/i, 'promises returns or no risk', ['finance']],
  [/\b(top|guaranteed) (rank|ranks|ranker|selection)\b|\bai?r ?\d{1,3}\b/i, 'promises exam results', ['education']],
  [/\bearn ₹?\d/i, 'income claim', ['finance', 'education']],
];

const STOP = new Set('no not dont don\'t do avoid any the a an of to and or for with above below more than less mention mentions use our we'.split(' '));

const words = (s) => s.toLowerCase().match(/[a-z0-9₹%]+/g) || [];

function similarity(a, b) {
  const A = new Set(words(a));
  const B = new Set(words(b));
  const inter = [...A].filter((w) => B.has(w)).length;
  return inter / (new Set([...A, ...B]).size || 1);
}

// Details from the input that copy can point to: numbers, proper nouns, the product name.
export function specificTokens(input) {
  const text = `${input.description} ${input.audience}`;
  const nums = text.match(/\d[\d,.]*/g) || [];
  const proper = (text.match(/(?<![.!?]\s)(?<!^)\b[A-Z][a-zA-Z]{2,}\b/g) || []).filter((w) => !['The', 'Our', 'They', 'Most', 'Many'].includes(w));
  const name = input.productName.split(/\s+/).filter((w) => w.length > 2);
  return [...new Set([...nums, ...proper, ...name].map((t) => t.toLowerCase().replace(/[.,]$/, '')))].filter((t) => t.length > 1);
}

function avoidTerms(avoid) {
  if (!avoid) return { discount: false, maxDiscount: null, terms: [] };
  const discount = /discount|% off|offer|sale/i.test(avoid);
  const cap = avoid.match(/(\d+)\s?%/);
  const terms = [];
  for (const m of avoid.matchAll(/\b(?:no|avoid|don'?t (?:mention|use|say))\s+([a-z][a-z\s-]{2,30})/gi)) {
    for (const w of words(m[1])) if (w.length > 3 && !STOP.has(w) && !/discount|offer|sale|claim/.test(w)) terms.push(w);
  }
  return { discount, maxDiscount: cap ? Number(cap[1]) : null, terms };
}

export function checkCopy(ai, channels, input) {
  const issues = [];
  const tokens = specificTokens(input);
  const avoid = avoidTerms(input.avoid);
  const add = (channel, variant, field, level, text) => issues.push({ channel, variant, field, level, text });

  for (const ch of channels) {
    const ad = ai.ads.find((a) => a.channel === ch.key);
    if (!ad || ad.variants.length < 2) {
      add(ch.key, null, null, 'error', `No A/B copy for ${ch.label}.`);
      continue;
    }
    const lim = CHANNELS[ch.key].limits;
    for (const v of ad.variants) {
      const all = `${v.headline} ${v.body} ${v.cta}`;
      for (const field of ['headline', 'body']) {
        const l = lim[field];
        if (l && v[field].length > l.max) {
          add(ch.key, v.label, field, l.hard ? 'error' : 'warn',
            `${field === 'headline' ? 'Headline' : 'Body'} is ${v[field].length} characters; ${ch.label} ${l.hard ? 'allows' : 'shows about'} ${l.max}${l.hard ? '' : ' before cutting it off'}.`);
        }
      }
      if (lim.bodyWords) {
        const n = words(v.body).length;
        if (n > lim.bodyWords.max) add(ch.key, v.label, 'body', 'warn', `Script is ${n} words; about ${lim.bodyWords.max} fit in 20 seconds.`);
      }
      const lower = all.toLowerCase();
      const filler = FILLER.filter((f) => lower.includes(f));
      if (filler.length) add(ch.key, v.label, null, 'warn', `Filler wording: "${filler.join('", "')}".`);
      for (const [re, what, strict] of RISKY) {
        if (re.test(all)) add(ch.key, v.label, null, strict.includes(input.businessType) ? 'error' : 'warn', `Risky claim: ${what}.`);
      }
      if (avoid.discount) {
        const pct = [...all.matchAll(/(\d+)\s?%\s?off/gi)].map((m) => Number(m[1]));
        const tooBig = avoid.maxDiscount !== null ? pct.some((p) => p > avoid.maxDiscount) : pct.length > 0 || /\bdiscount\b/i.test(all);
        if (tooBig) add(ch.key, v.label, null, 'error', 'Goes against your note about discounts.');
      }
      const hit = avoid.terms.filter((t) => lower.includes(t));
      if (hit.length) add(ch.key, v.label, null, 'error', `Mentions "${hit.join('", "')}", which you asked to avoid.`);
      if (tokens.length && !tokens.some((t) => lower.includes(t))) {
        add(ch.key, v.label, null, 'warn', 'Generic: mentions nothing specific to this product (no price, place, name or detail from your input).');
      }
    }
    const [a, b] = ad.variants;
    if (similarity(`${a.headline} ${a.body}`, `${b.headline} ${b.body}`) > 0.7) {
      add(ch.key, null, null, 'warn', 'Variants A and B are almost the same, so a test between them will not teach much.');
    }
  }
  return issues;
}

// Decide whether the issues are worth one more model call.
export function needsRetry(issues) {
  const errors = issues.filter((i) => i.level === 'error').length;
  const filler = issues.filter((i) => i.text.startsWith('Filler') || i.text.startsWith('Generic')).length;
  return errors > 0 || filler >= 2;
}

export function retryMessage(issues) {
  const lines = issues.map((i) => `- ${i.channel}${i.variant ? ` variant ${i.variant}` : ''}: ${i.text}`);
  return `Some of the copy breaks the rules. Fix only these problems and return the full JSON again with everything else unchanged:\n${lines.join('\n')}`;
}

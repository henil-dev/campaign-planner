// Picks channels, splits the budget and forecasts results. Runs before the AI call;
// the model only writes copy for the channels chosen here.
import {
  CHANNELS, CHANNEL_KEYS, BASE_CVR, CPC_MULTIPLIER, MARKET_MULTIPLIER,
  FIT_BY_BUSINESS, FIT_BY_GOAL, AUDIENCE_SIGNALS,
} from '../channels.js';

const round = (n, step) => Math.round(n / step) * step;

// Score each channel 0-100 and say why.
export function scoreChannels(input) {
  return CHANNEL_KEYS.map((key) => {
    const biz = FIT_BY_BUSINESS[input.businessType][key];
    const goal = FIT_BY_GOAL[input.goal][key];
    const reasons = [`${biz}/5 fit for this type of business`, `${goal}/5 fit for the goal`];

    let signal = 0;
    for (const s of AUDIENCE_SIGNALS) {
      if (s.channel === key && s.re.test(input.audience)) {
        signal = 1;
        reasons.push(s.why);
        break;
      }
    }
    // 45% business fit, 35% goal fit, 20% audience wording.
    const score = Math.round(((biz / 5) * 0.45 + (goal / 5) * 0.35 + signal * 0.2) * 100);
    return { key, label: CHANNELS[key].label, score, reasons };
  }).sort((a, b) => b.score - a.score);
}

function maxChannelsFor(budget) {
  if (budget < 30000) return 1;
  if (budget < 75000) return 2;
  if (budget < 200000) return 3;
  return 4;
}

// Rates for one channel after category and market adjustments.
export function channelRates(key, input) {
  const c = CHANNELS[key];
  const m = MARKET_MULTIPLIER[input.market] * CPC_MULTIPLIER[input.businessType];
  return {
    cpc: c.cpc * m,
    cpm: c.cpm * MARKET_MULTIPLIER[input.market],
    ctr: c.ctr,
    cvr: Math.min(0.5, BASE_CVR[input.goal] * c.intent),
    minMonthly: c.minMonthly * Math.max(1, MARKET_MULTIPLIER[input.market] / 2),
  };
}

export function forecast(key, budget, input) {
  const r = channelRates(key, input);
  const clicks = budget / r.cpc;
  const impressions = clicks / r.ctr;
  const results = clicks * r.cvr;
  const out = {
    impressions: Math.round(impressions),
    clicks: Math.round(clicks),
    results: Math.round(results * 10) / 10,
    costPerResult: results > 0 ? budget / results : null,
    cvr: r.cvr,
    ctr: r.ctr,
  };
  if (input.orderValue && input.goal === 'sales') out.roas = (results * input.orderValue) / budget;
  return out;
}

export function planChannels(input) {
  const scored = scoreChannels(input);
  const notes = [];
  const limit = maxChannelsFor(input.budget);
  const chosen = [];
  let committed = 0;

  for (const s of scored) {
    if (chosen.length >= limit) break;
    if (s.score < 45) continue; // weak fit: not worth splitting the money for
    const min = channelRates(s.key, input).minMonthly;
    if (committed + min > input.budget) {
      s.skipped = `needs about ₹${round(min, 1000).toLocaleString('en-IN')}/month to get past the learning phase`;
      continue;
    }
    chosen.push(s);
    committed += min;
  }

  let underfunded = false;
  if (!chosen.length) {
    // Nothing fits the budget: take the best fit per rupee of minimum spend, and say so.
    const pool = scored.filter((s) => s.score >= 45);
    const pick = (pool.length ? pool : scored).reduce((best, s) =>
      s.score / channelRates(s.key, input).minMonthly > best.score / channelRates(best.key, input).minMonthly ? s : best);
    delete pick.skipped;
    chosen.push(pick);
    underfunded = true;
    notes.push(`The budget is below the usual minimum for ${pick.label}. Results will be slow and noisy; treat the first month as a test.`);
  }

  // Split by score squared so the strongest fit gets a clear lead, then lift anyone under their minimum.
  const weights = chosen.map((c) => c.score ** 2);
  const total = weights.reduce((a, b) => a + b, 0);
  let split = chosen.map((c, i) => ({ c, budget: (input.budget * weights[i]) / total }));
  for (let pass = 0; pass < 3 && !underfunded; pass++) {
    const short = split.filter((s) => s.budget < channelRates(s.c.key, input).minMonthly);
    if (!short.length) break;
    let needed = 0;
    for (const s of short) {
      const min = channelRates(s.c.key, input).minMonthly;
      needed += min - s.budget;
      s.budget = min;
    }
    const donors = split.filter((s) => !short.includes(s));
    const donorTotal = donors.reduce((a, s) => a + s.budget, 0);
    for (const d of donors) d.budget -= (needed * d.budget) / donorTotal;
  }

  // Round to ₹500 and give any rounding remainder to the top channel.
  split = split.map((s) => ({ ...s, budget: round(s.budget, 500) }));
  split[0].budget += input.budget - split.reduce((a, s) => a + s.budget, 0);

  const channels = split.map(({ c, budget }) => ({
    key: c.key,
    label: c.label,
    score: c.score,
    reasons: c.reasons,
    budget,
    share: budget / input.budget,
    forecast: forecast(c.key, budget, input),
  }));

  const skipped = scored
    .filter((s) => !chosen.includes(s))
    .map((s) => ({ key: s.key, label: s.label, score: s.score, why: s.skipped || (s.score < 45 ? 'weak fit for this business and goal' : `budget only stretches to ${limit} channel${limit > 1 ? 's' : ''}`) }));

  const totals = channels.reduce(
    (t, c) => ({ clicks: t.clicks + c.forecast.clicks, results: t.results + c.forecast.results, impressions: t.impressions + c.forecast.impressions }),
    { clicks: 0, results: 0, impressions: 0 }
  );
  totals.costPerResult = totals.results > 0 ? input.budget / totals.results : null;
  if (input.orderValue && input.goal === 'sales') {
    totals.roas = (totals.results * input.orderValue) / input.budget;
    if (totals.roas < 1) notes.push(`At these rates each sale costs about ₹${Math.round(totals.costPerResult).toLocaleString('en-IN')}, more than the ₹${input.orderValue.toLocaleString('en-IN')} order value. Repeat purchases or a higher order value are needed to break even.`);
  }
  if (input.orderValue && input.goal === 'leads' && totals.costPerResult) {
    // Assume 1 in 10 leads becomes a customer; a common planning figure for small businesses.
    const perCustomer = totals.costPerResult * 10;
    totals.costPerCustomer = perCustomer;
    if (perCustomer > input.orderValue) notes.push(`If 1 in 10 leads buys, a customer costs about ₹${Math.round(perCustomer).toLocaleString('en-IN')}, above the ₹${input.orderValue.toLocaleString('en-IN')} deal value. The landing page and follow-up need to convert better than that.`);
  }

  return { scored, channels, skipped, totals, notes, underfunded };
}

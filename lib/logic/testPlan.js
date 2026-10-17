// Sizes each A/B test against the traffic the budget actually buys.
// Two-sided test, 95% confidence, 80% power, 50/50 split.

const Z_ALPHA = 1.96;
const Z_BETA = 0.8416;
const DEFAULT_LIFT = 0.2; // smallest relative improvement we want to be able to detect

// Visitors (or impressions) needed in EACH variant to detect a relative lift over baseline p.
export function sampleSizePerVariant(p, lift = DEFAULT_LIFT) {
  const p2 = Math.min(0.99, p * (1 + lift));
  const num = (Z_ALPHA + Z_BETA) ** 2 * (p * (1 - p) + p2 * (1 - p2));
  return Math.ceil(num / (p2 - p) ** 2);
}

// Smallest lift (in 5% steps) the test can detect with the units available per variant.
function detectableLift(p, unitsPerVariant) {
  for (let lift = 0.1; lift <= 3; lift += 0.05) {
    if (sampleSizePerVariant(p, lift) <= unitsPerVariant) return Math.round(lift * 100) / 100;
  }
  return null;
}

const METRIC_UNITS = {
  ctr: { unit: 'impressions', base: (f) => f.ctr, volume: (f) => f.impressions },
  conversion_rate: { unit: 'clicks', base: (f) => f.cvr, volume: (f) => f.clicks },
  cost_per_result: { unit: 'clicks', base: (f) => f.cvr, volume: (f) => f.clicks },
};

export function sizeTests(tests, channels, weeks) {
  const byKey = Object.fromEntries(channels.map((c) => [c.key, c]));
  const sized = tests.map((t) => {
    const ch = byKey[t.channel] || channels[0];
    const m = METRIC_UNITS[t.metric] || METRIC_UNITS.conversion_rate;
    const baseline = m.base(ch.forecast);
    const perVariant = sampleSizePerVariant(baseline);
    const weekly = m.volume(ch.forecast) / (30 / 7); // forecast is monthly
    const perVariantWeekly = weekly / 2;
    const weeksNeeded = perVariantWeekly > 0 ? perVariant / perVariantWeekly : Infinity;
    const available = perVariantWeekly * weeks;
    const feasible = weeksNeeded <= weeks;
    return {
      ...t,
      channel: ch.key,
      unit: m.unit,
      baseline,
      perVariant,
      weeksNeeded: Math.round(weeksNeeded * 10) / 10,
      feasible,
      detectableLift: feasible ? DEFAULT_LIFT : detectableLift(baseline, available),
    };
  });

  // Tests on the same channel can't run at once without splitting traffic further: run them back to back.
  const used = {};
  for (const t of sized.sort((a, b) => a.weeksNeeded - b.weeksNeeded)) {
    t.startWeek = Math.round((used[t.channel] || 0) * 10) / 10 + 1;
    used[t.channel] = (used[t.channel] || 0) + Math.min(t.weeksNeeded, weeks);
    if (t.feasible && t.startWeek - 1 + t.weeksNeeded > weeks) {
      t.feasible = false;
      t.sequenceNote = 'Shares a channel with an earlier test and will not finish within the campaign.';
    }
  }

  sized.sort((a, b) => (b.feasible - a.feasible) || (a.weeksNeeded - b.weeksNeeded));
  sized.forEach((t, i) => {
    if (t.feasible) t.verdict = 'Can finish within the campaign.';
    else if (t.sequenceNote) t.verdict = `${t.sequenceNote} Run it next month or drop it.`;
    else if (t.detectableLift) t.verdict = `Not enough traffic to detect a 20% change. With this budget only a ${Math.round(t.detectableLift * 100)}% or bigger change will show up, so make the two versions very different or drop this test.`;
    else t.verdict = 'Not enough traffic for a reliable result at this budget. Run it as a rough check, or drop it.';
    t.priority = i + 1;
  });
  return sized;
}

// Used when the AI step is unavailable: one headline test on the main channel.
export function fallbackTests(channels) {
  return [{
    channel: channels[0].key,
    variable: 'headline',
    hypothesis: 'A headline that names the problem will get more clicks than one that names the product.',
    variantA: 'Headline about the product',
    variantB: 'Headline about the problem it solves',
    metric: 'ctr',
    fromRules: true,
  }];
}

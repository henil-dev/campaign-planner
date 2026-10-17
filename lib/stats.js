// Numbers for the admin dashboard.
import { db } from './db.js';

// Gemini 2.5 Flash list price per million tokens (USD). Output includes thinking tokens.
// Change here if the model or price changes.
const PRICE = { inPerM: 0.3, outPerM: 2.5, usdToInr: 88 };

// Group issue messages from copyCheck.js into a few named buckets.
function issueBucket(text) {
  if (/characters|words; about/.test(text)) return 'Too long for the channel';
  if (text.startsWith('Filler')) return 'Filler wording';
  if (text.startsWith('Risky claim')) return 'Risky claim';
  if (text.startsWith('Generic')) return 'Generic, nothing product-specific';
  if (text.includes('almost the same')) return 'A and B too similar';
  if (/avoid|discounts/.test(text)) return "Breaks the user's 'avoid' note";
  if (text.startsWith('No A/B copy')) return 'Missing copy for a channel';
  return 'Other';
}

// tzOffset: minutes east of UTC from the browser, so "per day" matches the viewer's calendar.
export function dashboardStats(tzOffset = 0) {
  const shift = `${tzOffset >= 0 ? '+' : ''}${Math.round(tzOffset)} minutes`;
  const t = db.prepare(`
    SELECT COUNT(*) AS plans,
      SUM(created_at >= datetime('now', '-7 days')) AS last7,
      SUM(status = 'complete') AS complete,
      SUM(status = 'ai_error') AS aiErrors,
      SUM(status = 'no_key') AS noKey,
      ROUND(AVG(readiness_score), 1) AS avgScore,
      SUM(readiness_level = 'ready') AS ready,
      SUM(readiness_level = 'review') AS review,
      SUM(readiness_level = 'rework') AS rework,
      SUM(retried) AS retried,
      ROUND(AVG(CASE WHEN status = 'complete' THEN latency_ms END)) AS avgLatency,
      SUM(tokens_in) AS tokensIn,
      SUM(tokens_out) AS tokensOut,
      SUM(feedback = 1) AS useful,
      SUM(feedback = -1) AS notUseful,
      SUM(review_status = 'approved') AS approved,
      SUM(tests_blocked > 0) AS withBlockedTests
    FROM plans`).get();

  for (const k of Object.keys(t)) t[k] = t[k] ?? 0;
  const costUsd = (t.tokensIn / 1e6) * PRICE.inPerM + (t.tokensOut / 1e6) * PRICE.outPerM;
  t.costInr = Math.round(costUsd * PRICE.usdToInr * 100) / 100;
  t.costPerPlanInr = t.complete ? Math.round((t.costInr / t.complete) * 100) / 100 : 0;

  // Last 14 days, including days with no plans.
  const byDay = db.prepare(`
    SELECT date(created_at, @shift) AS day, COUNT(*) AS plans, SUM(status != 'complete') AS failed
    FROM plans WHERE date(created_at, @shift) >= date('now', @shift, '-13 days') GROUP BY day`).all({ shift });
  const map = Object.fromEntries(byDay.map((d) => [d.day, d]));
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() + tzOffset * 6e4 - i * 864e5).toISOString().slice(0, 10);
    days.push({ day: d, plans: map[d]?.plans || 0, failed: map[d]?.failed || 0 });
  }

  const channelCounts = {};
  for (const r of db.prepare('SELECT channels FROM plans').all()) {
    for (const c of r.channels.split(',')) channelCounts[c] = (channelCounts[c] || 0) + 1;
  }

  const business = db.prepare('SELECT business_type AS key, COUNT(*) AS n FROM plans GROUP BY business_type ORDER BY n DESC').all();

  // Issue types across the latest 300 plans (from the stored result JSON).
  const issues = {};
  for (const r of db.prepare('SELECT result_json FROM plans ORDER BY id DESC LIMIT 300').all()) {
    for (const i of JSON.parse(r.result_json).issues || []) {
      const b = issueBucket(i.text);
      issues[b] = issues[b] || { error: 0, warn: 0 };
      issues[b][i.level]++;
    }
  }

  const events = db.prepare('SELECT id, created_at, plan_id, kind, detail FROM events ORDER BY id DESC LIMIT 40').all();
  const validationFails7 = db.prepare("SELECT COUNT(*) AS n FROM events WHERE kind = 'validation_failed' AND created_at >= datetime('now', '-7 days')").get().n;

  return {
    totals: t,
    days,
    channels: Object.entries(channelCounts).map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n),
    business,
    issues: Object.entries(issues).map(([name, v]) => ({ name, ...v, total: v.error + v.warn })).sort((a, b) => b.total - a.total),
    events,
    validationFails7,
    price: PRICE,
  };
}

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function plansCsv(rows) {
  const cols = ['id', 'created_at', 'product_name', 'business_type', 'goal', 'budget', 'weeks', 'channels', 'status',
    'readiness_score', 'readiness_level', 'error_count', 'warn_count', 'tests_blocked', 'retried', 'review_status',
    'feedback', 'latency_ms', 'tokens_in', 'tokens_out'];
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n');
}

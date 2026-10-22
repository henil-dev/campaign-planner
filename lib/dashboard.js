// Admin dashboard numbers, computed from plan summary rows. No Node or browser APIs, so the
// server (rows from SQLite) and the Claude page (rows from the page database) share it.
//
// A row: { id, created_at, product_name, business_type, channels (array or comma string), status,
//   readiness_score, readiness_level, retried, latency_ms, tokens_in, tokens_out, feedback,
//   review_status, tests_blocked, issues: [{ text, level }] }
// An event: { id, created_at, plan_id, kind, detail }

// SQLite stores 'YYYY-MM-DD HH:MM:SS' in UTC; the page database stores ISO strings.
export const toDate = (s) => new Date(String(s).includes('T') ? s : String(s).replace(' ', 'T') + 'Z');

// Group issue messages from copyCheck.js into a few named buckets.
export function issueBucket(text) {
  if (/characters|words; about/.test(text)) return 'Too long for the channel';
  if (text.startsWith('Filler')) return 'Filler wording';
  if (text.startsWith('Risky claim')) return 'Risky claim';
  if (text.startsWith('Generic')) return 'Generic, nothing product-specific';
  if (text.includes('almost the same')) return 'A and B too similar';
  if (/avoid|discounts/.test(text)) return "Breaks the user's 'avoid' note";
  if (text.startsWith('No A/B copy')) return 'Missing copy for a channel';
  return 'Other';
}

const channelList = (c) => (Array.isArray(c) ? c : String(c || '').split(',').filter(Boolean));

// price: { inPerM, outPerM, usdToInr } when token cost applies, or null (Claude page: runs on the viewer's plan).
// tzOffset: minutes east of UTC, so "per day" follows the viewer's calendar.
export function computeDashboard({ rows, events, tzOffset = 0, price = null, now = Date.now() }) {
  const count = (f) => rows.filter(f).length;
  const sum = (f) => rows.reduce((a, r) => a + (Number(f(r)) || 0), 0);
  const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const weekAgo = now - 7 * 864e5;

  const complete = rows.filter((r) => r.status === 'complete');
  const t = {
    plans: rows.length,
    last7: count((r) => toDate(r.created_at) >= weekAgo),
    complete: complete.length,
    aiErrors: count((r) => r.status === 'ai_error'),
    noKey: count((r) => r.status === 'no_key'),
    avgScore: Math.round(avg(rows.map((r) => r.readiness_score)) * 10) / 10,
    ready: count((r) => r.readiness_level === 'ready'),
    review: count((r) => r.readiness_level === 'review'),
    rework: count((r) => r.readiness_level === 'rework'),
    retried: count((r) => r.retried),
    avgLatency: Math.round(avg(complete.map((r) => r.latency_ms).filter(Boolean))),
    tokensIn: sum((r) => r.tokens_in),
    tokensOut: sum((r) => r.tokens_out),
    useful: count((r) => r.feedback === 1),
    notUseful: count((r) => r.feedback === -1),
    approved: count((r) => r.review_status === 'approved'),
    withBlockedTests: count((r) => r.tests_blocked > 0),
    costInr: null,
    costPerPlanInr: null,
  };
  if (price) {
    const usd = (t.tokensIn / 1e6) * price.inPerM + (t.tokensOut / 1e6) * price.outPerM;
    t.costInr = Math.round(usd * price.usdToInr * 100) / 100;
    t.costPerPlanInr = t.complete ? Math.round((t.costInr / t.complete) * 100) / 100 : 0;
  }

  // Last 14 days in the viewer's time zone, including empty days.
  const localDay = (ms) => new Date(ms + tzOffset * 6e4).toISOString().slice(0, 10);
  const days = [];
  for (let i = 13; i >= 0; i--) days.push({ day: localDay(now - i * 864e5), plans: 0, failed: 0 });
  const byDay = Object.fromEntries(days.map((d) => [d.day, d]));
  for (const r of rows) {
    const d = byDay[localDay(toDate(r.created_at).getTime())];
    if (d) { d.plans++; if (r.status !== 'complete') d.failed++; }
  }

  const tally = (keys) => {
    const m = {};
    for (const k of keys) m[k] = (m[k] || 0) + 1;
    return Object.entries(m).map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n);
  };

  const issues = {};
  for (const r of rows.slice(0, 300)) {
    for (const i of r.issues || []) {
      const b = issueBucket(i.text);
      issues[b] = issues[b] || { error: 0, warn: 0 };
      issues[b][i.level === 'error' ? 'error' : 'warn']++;
    }
  }

  const sortedEvents = [...events].sort((a, b) => toDate(b.created_at) - toDate(a.created_at));
  return {
    totals: t,
    days,
    channels: tally(rows.flatMap((r) => channelList(r.channels))),
    business: tally(rows.map((r) => r.business_type)),
    issues: Object.entries(issues).map(([name, v]) => ({ name, ...v, total: v.error + v.warn })).sort((a, b) => b.total - a.total),
    events: sortedEvents.slice(0, 40),
    validationFails7: events.filter((e) => e.kind === 'validation_failed' && toDate(e.created_at) >= weekAgo).length,
    price,
  };
}

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : Array.isArray(v) ? v.join(',') : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function plansCsv(rows) {
  const cols = ['id', 'created_at', 'product_name', 'business_type', 'goal', 'budget', 'weeks', 'channels', 'status',
    'readiness_score', 'readiness_level', 'error_count', 'warn_count', 'tests_blocked', 'retried', 'review_status',
    'feedback', 'latency_ms', 'tokens_in', 'tokens_out'];
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n');
}

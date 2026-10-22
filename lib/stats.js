// Admin dashboard numbers for the Node server: reads SQLite, then uses the shared lib/dashboard.js.
import { db } from './db.js';
import { computeDashboard } from './dashboard.js';

export { plansCsv } from './dashboard.js';

// Gemini 2.5 Flash list price per million tokens (USD). Output includes thinking tokens.
// Change here if the model or price changes.
const PRICE = { inPerM: 0.3, outPerM: 2.5, usdToInr: 88 };

export function dashboardStats(tzOffset = 0) {
  const rows = db.prepare(`
    SELECT id, created_at, product_name, business_type, channels, status, readiness_score, readiness_level,
      retried, latency_ms, tokens_in, tokens_out, feedback, review_status, tests_blocked, result_json
    FROM plans ORDER BY id DESC LIMIT 2000`).all()
    .map(({ result_json, ...r }) => ({ ...r, issues: JSON.parse(result_json).issues || [] }));
  const events = db.prepare('SELECT id, created_at, plan_id, kind, detail FROM events ORDER BY id DESC LIMIT 2000').all();
  return computeDashboard({ rows, events, tzOffset, price: PRICE });
}

// SQLite storage. One row per plan with summary columns for the dashboard,
// plus the full input and result as JSON so a saved plan renders exactly as it did.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const file = path.resolve(root, process.env.DB_PATH || 'data/campaigns.db');
fs.mkdirSync(path.dirname(file), { recursive: true });

const db = new Database(file);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS plans (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  product_name    TEXT NOT NULL,
  business_type   TEXT NOT NULL,
  goal            TEXT NOT NULL,
  market          TEXT NOT NULL,
  budget          INTEGER NOT NULL,
  weeks           INTEGER NOT NULL,
  status          TEXT NOT NULL,              -- complete | ai_error | no_key
  readiness_score INTEGER NOT NULL,
  readiness_level TEXT NOT NULL,              -- ready | review | rework
  channels        TEXT NOT NULL,              -- comma-separated channel keys
  error_count     INTEGER NOT NULL DEFAULT 0,
  warn_count      INTEGER NOT NULL DEFAULT 0,
  tests_blocked   INTEGER NOT NULL DEFAULT 0,
  retried         INTEGER NOT NULL DEFAULT 0,
  model           TEXT,
  tokens_in       INTEGER NOT NULL DEFAULT 0,
  tokens_out      INTEGER NOT NULL DEFAULT 0,
  latency_ms      INTEGER NOT NULL DEFAULT 0,
  error           TEXT,
  review_status   TEXT NOT NULL DEFAULT 'new', -- new | approved | archived (set by admin)
  feedback        INTEGER,                     -- 1 useful, -1 not useful, NULL no answer
  input_json      TEXT NOT NULL,
  result_json     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS plans_created ON plans(created_at);

CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  plan_id    INTEGER REFERENCES plans(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,                    -- plan_saved | ai_error | retry | validation_failed | rate_limited
  detail     TEXT
);
CREATE INDEX IF NOT EXISTS events_created ON events(created_at);
`);

const insertPlan = db.prepare(`
  INSERT INTO plans (product_name, business_type, goal, market, budget, weeks, status, readiness_score, readiness_level,
    channels, error_count, warn_count, tests_blocked, retried, model, tokens_in, tokens_out, latency_ms, error, input_json, result_json)
  VALUES (@product_name, @business_type, @goal, @market, @budget, @weeks, @status, @readiness_score, @readiness_level,
    @channels, @error_count, @warn_count, @tests_blocked, @retried, @model, @tokens_in, @tokens_out, @latency_ms, @error, @input_json, @result_json)
`);
const insertEvent = db.prepare('INSERT INTO events (plan_id, kind, detail) VALUES (?, ?, ?)');

export function logEvent(kind, detail = null, planId = null) {
  insertEvent.run(planId, kind, detail ? String(detail).slice(0, 500) : null);
}

export const savePlan = db.transaction((result) => {
  const i = result.input;
  const { lastInsertRowid: id } = insertPlan.run({
    product_name: i.productName,
    business_type: i.businessType,
    goal: i.goal,
    market: i.market,
    budget: i.budget,
    weeks: i.weeks,
    status: result.status,
    readiness_score: result.readiness.score,
    readiness_level: result.readiness.level,
    channels: result.channelPlan.channels.map((c) => c.key).join(','),
    error_count: result.issues.filter((x) => x.level === 'error').length,
    warn_count: result.issues.filter((x) => x.level === 'warn').length,
    tests_blocked: result.tests.filter((t) => !t.feasible).length,
    retried: result.meta.retried ? 1 : 0,
    model: result.ai ? result.meta.model : null,
    tokens_in: Math.round(result.meta.tokensIn),
    tokens_out: Math.round(result.meta.tokensOut),
    latency_ms: result.meta.latencyMs,
    error: result.meta.error,
    input_json: JSON.stringify(i),
    result_json: JSON.stringify(result),
  });
  logEvent('plan_saved', `${i.productName}: ${result.status}, score ${result.readiness.score}`, id);
  if (result.meta.retried) logEvent('retry', `${result.meta.issuesBeforeRetry} issues in first draft`, id);
  if (result.status === 'ai_error') logEvent('ai_error', result.meta.error, id);
  return Number(id);
});

export function getPlan(id) {
  const row = db.prepare('SELECT * FROM plans WHERE id = ?').get(id);
  if (!row) return null;
  return { id: row.id, createdAt: row.created_at, reviewStatus: row.review_status, feedback: row.feedback, ...JSON.parse(row.result_json) };
}

const LIST_COLS = `id, created_at, product_name, business_type, goal, budget, weeks, status, readiness_score,
  readiness_level, channels, error_count, warn_count, tests_blocked, retried, review_status, feedback, latency_ms, tokens_in, tokens_out`;

export function listPlans({ q = '', limit = 50, status = '', level = '', review = '', includeArchived = false } = {}) {
  const where = [];
  const args = {};
  if (q) { where.push('product_name LIKE @q'); args.q = `%${q}%`; }
  if (status) { where.push('status = @status'); args.status = status; }
  if (level) { where.push('readiness_level = @level'); args.level = level; }
  if (review) { where.push('review_status = @review'); args.review = review; }
  else if (!includeArchived) where.push("review_status != 'archived'");
  args.limit = Math.min(Math.max(Number(limit) || 50, 1), 500);
  const sql = `SELECT ${LIST_COLS} FROM plans ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT @limit`;
  return db.prepare(sql).all(args);
}

export function setReviewStatus(id, status) {
  const ok = db.prepare('UPDATE plans SET review_status = ? WHERE id = ?').run(status, id).changes > 0;
  if (ok) logEvent('review_status', `set to ${status}`, id);
  return ok;
}

export function deletePlan(id) {
  const row = db.prepare('SELECT product_name FROM plans WHERE id = ?').get(id);
  if (!row) return false;
  db.prepare('DELETE FROM plans WHERE id = ?').run(id);
  logEvent('plan_deleted', `#${id} ${row.product_name}`);
  return true;
}

export function setFeedback(id, value) {
  return db.prepare('UPDATE plans SET feedback = ? WHERE id = ?').run(value, id).changes > 0;
}

export { db };

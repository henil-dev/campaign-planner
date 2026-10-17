import './lib/env.js';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateInput } from './lib/validate.js';
import { runPlan } from './lib/planner.js';
import { llmConfigured, modelName } from './lib/llm.js';
import { savePlan, getPlan, listPlans, setFeedback, setReviewStatus, deletePlan, logEvent } from './lib/db.js';
import { dashboardStats, plansCsv } from './lib/stats.js';
import crypto from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));

// Admin is open when ADMIN_PASSWORD is unset (local dev); otherwise HTTP Basic auth, any username.
function adminOnly(req, res, next) {
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass) return next();
  const [scheme, encoded] = (req.headers.authorization || '').split(' ');
  const given = scheme === 'Basic' && encoded ? Buffer.from(encoded, 'base64').toString().split(':').slice(1).join(':') : '';
  const a = Buffer.from(given);
  const b = Buffer.from(pass);
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) return next();
  res.set('WWW-Authenticate', 'Basic realm="Campaign Planner admin"').status(401).send('Admin password required.');
}
app.use(['/admin', '/admin.html', '/admin.js', '/api/admin'], adminOnly);

app.use(express.static(path.join(here, 'public'), { extensions: ['html'] }));

// Each plan costs an AI call, so cap it per visitor: 20 an hour, kept in memory.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 3600_000);
  if (recent.length >= 20) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

app.post('/api/plan', async (req, res) => {
  const v = validateInput(req.body);
  if (!v.ok) {
    logEvent('validation_failed', Object.keys(v.fields).join(', '));
    return res.status(422).json({ error: 'Some fields need fixing.', fields: v.fields });
  }
  if (rateLimited(req.ip)) {
    logEvent('rate_limited', req.ip);
    return res.status(429).json({ error: 'That is 20 plans in the last hour from this connection. Try again later.' });
  }

  const result = await runPlan(v.data);
  const id = savePlan(result);
  res.json({ id, ...result });
});

app.get('/api/plans', (req, res) => {
  res.json(listPlans({ q: String(req.query.q || '').slice(0, 60), limit: req.query.limit }));
});

app.get('/api/plans/:id', (req, res) => {
  const plan = getPlan(Number(req.params.id));
  if (!plan) return res.status(404).json({ error: 'No saved plan with that number.' });
  res.json(plan);
});

app.post('/api/plans/:id/feedback', (req, res) => {
  const value = req.body?.useful === true ? 1 : req.body?.useful === false ? -1 : null;
  if (value === null) return res.status(400).json({ error: 'Send { "useful": true } or { "useful": false }.' });
  if (!setFeedback(Number(req.params.id), value)) return res.status(404).json({ error: 'No saved plan with that number.' });
  res.json({ ok: true });
});

app.get('/api/admin/stats', (req, res) => {
  const tz = Math.max(-840, Math.min(840, Number(req.query.tz) || 0));
  res.json(dashboardStats(tz));
});

app.get('/api/admin/plans', (req, res) => {
  const q = (k) => String(req.query[k] || '').slice(0, 60);
  res.json(listPlans({ q: q('q'), status: q('status'), level: q('level'), review: q('review'), includeArchived: true, limit: 500 }));
});

app.patch('/api/admin/plans/:id', (req, res) => {
  const status = req.body?.reviewStatus;
  if (!['new', 'approved', 'archived'].includes(status)) return res.status(400).json({ error: 'reviewStatus must be new, approved or archived.' });
  if (!setReviewStatus(Number(req.params.id), status)) return res.status(404).json({ error: 'No plan with that number.' });
  res.json({ ok: true });
});

app.delete('/api/admin/plans/:id', (req, res) => {
  if (!deletePlan(Number(req.params.id))) return res.status(404).json({ error: 'No plan with that number.' });
  res.json({ ok: true });
});

app.get('/api/admin/export.csv', (req, res) => {
  const day = new Date().toISOString().slice(0, 10);
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="campaign-plans-${day}.csv"`);
  res.send(plansCsv(listPlans({ includeArchived: true, limit: 500 })));
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, llm: llmConfigured(), model: modelName() });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON.' });
  res.status(500).json({ error: 'Something went wrong on the server. Try again.' });
});

app.listen(PORT, () => {
  console.log(`campaign-planner on http://localhost:${PORT}`);
});

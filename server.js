import './lib/env.js';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateInput } from './lib/validate.js';
import { runPlan } from './lib/planner.js';
import { llmConfigured, modelName } from './lib/llm.js';
import { savePlan, getPlan, listPlans, setFeedback, logEvent } from './lib/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));
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

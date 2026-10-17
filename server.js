import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateInput } from './lib/validate.js';
import { runPlan } from './lib/planner.js';
import { llmConfigured, modelName } from './lib/llm.js';

const here = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.join(here, '.env')); } catch { /* no .env file, use real env */ }

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(here, 'public'), { extensions: ['html'] }));

app.post('/api/plan', async (req, res) => {
  const v = validateInput(req.body);
  if (!v.ok) return res.status(422).json({ error: 'Some fields need fixing.', fields: v.fields });

  const result = await runPlan(v.data);
  res.json(result);
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

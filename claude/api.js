// Backend for the Claude-hosted page. Same methods as public/api.js, but nothing leaves the page:
// validation and the logic layer run here, Claude writes the copy (the `sample` capability) and
// plans are stored in the page's own database (the `db` capability).
import { validateInput } from './lib/validate.js';
import { runPlan } from './lib/planner.js';
import { computeDashboard, plansCsv } from './lib/dashboard.js';

// claude.use() resolves null when this view can't run a capability (signed out, not granted, outside claude.ai).
const use = (name) => (window.claude?.use ? window.claude.use(name).catch(() => null) : Promise.resolve(null));
const sampleP = use('sample');
const dbP = use('db');
const userP = use('user');
const downloadsP = use('downloads');

const SAMPLE_ERRORS = {
  not_granted: 'You did not allow this page to use Claude. Reload the page to be asked again.',
  sampling_disabled: 'Claude is not available on this account.',
  rate_limited: 'Claude usage limit reached for now.',
  session_expired: 'Your Claude session expired. Sign in again and rerun.',
  refused: 'Claude declined this request. Try rewording the product description.',
  empty_completion: 'Claude returned an empty answer. Try again.',
  prompt_too_large: 'The description is too long for one request. Shorten it and try again.',
};

// Model adapter for lib/planner.js.
async function claudeAdapter() {
  const sample = await sampleP;
  return {
    name: 'Claude',
    configured: Boolean(sample),
    missingNote: 'Claude is not available in this view (open the page on claude.ai while signed in).',
    async generate({ system, turns, schema }) {
      // Claude gets no separate system role here, so the rules and the output shape ride in the first turn.
      const format = `Reply with only one JSON object, no other text, matching this JSON Schema:\n${JSON.stringify(schema)}`;
      const messages = turns.map((t, i) => ({
        role: t.role === 'model' ? 'assistant' : 'user',
        content: i === 0 ? `${system}\n\n${format}\n\n${t.text}` : t.text,
      }));
      try {
        const r = await sample(messages, { modelTier: 'default' });
        if (r.truncated) throw { code: 'truncated' };
        return { text: r.text, model: r.modelApplied || `Claude (${r.modelTierApplied} tier)`, tokensIn: 0, tokensOut: 0 };
      } catch (e) {
        if (e?.code === 'truncated') throw new Error('Claude ran out of space before finishing the plan. Try again.');
        throw new Error(SAMPLE_ERRORS[e?.code] || `Claude call failed (${e?.code || 'unknown error'}).`);
      }
    },
  };
}

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
// The store rejects undefined values; a JSON round trip drops them.
const plain = (x) => JSON.parse(JSON.stringify(x));

async function requireDb() {
  const db = await dbP;
  if (!db) throw new Error('Saved plans are only available when this page is opened on claude.ai while signed in.');
  return db;
}

async function logEvent(kind, detail = null, planId = null) {
  const db = await dbP;
  if (!db) return;
  db.collection('events').doc(newId())
    .set({ created_at: new Date().toISOString(), kind, detail: detail ? String(detail).slice(0, 500) : null, plan_id: planId })
    .catch(() => {});
}

function summaryRow(result) {
  const i = result.input;
  return {
    created_at: new Date().toISOString(),
    product_name: i.productName,
    business_type: i.businessType,
    goal: i.goal,
    market: i.market,
    budget: i.budget,
    weeks: i.weeks,
    status: result.status,
    readiness_score: result.readiness.score,
    readiness_level: result.readiness.level,
    channels: result.channelPlan.channels.map((c) => c.key),
    error_count: result.issues.filter((x) => x.level === 'error').length,
    warn_count: result.issues.filter((x) => x.level === 'warn').length,
    tests_blocked: result.tests.filter((t) => !t.feasible).length,
    retried: result.meta.retried ? 1 : 0,
    model: result.ai ? result.meta.model : null,
    tokens_in: 0,
    tokens_out: 0,
    latency_ms: result.meta.latencyMs,
    error: result.meta.error,
    review_status: 'new',
    feedback: null,
    issues: result.issues.map(({ text, level }) => ({ text, level })),
  };
}

const SUMMARY_KEYS = ['created_at', 'product_name', 'business_type', 'goal', 'market', 'budget', 'weeks', 'status',
  'readiness_score', 'readiness_level', 'channels', 'error_count', 'warn_count', 'tests_blocked', 'retried', 'model',
  'tokens_in', 'tokens_out', 'latency_ms', 'error', 'review_status', 'feedback', 'issues'];

function summary(doc) {
  const d = doc.data();
  const row = { id: doc.id };
  for (const k of SUMMARY_KEYS) row[k] = d[k] ?? null;
  return row;
}

async function allRows(limit = 1000) {
  const db = await requireDb();
  const snap = await db.collection('plans').orderBy('created_at', 'desc').limit(limit).get();
  return snap.docs.map(summary);
}

async function canEdit() {
  const user = await userP;
  return Boolean(user && (await user.canEdit().catch(() => false)));
}

async function requireEditor() {
  if (!(await canEdit())) throw new Error('Only people who can edit this page can change plans.');
  return requireDb();
}

window.API = {
  links: {
    newPlan: '#new',
    plans: '#plans',
    plan: (id) => `#plan-${encodeURIComponent(id)}`,
    admin: '#admin',
  },

  async createPlan(data) {
    const v = validateInput(data);
    if (!v.ok) {
      logEvent('validation_failed', Object.keys(v.fields).join(', '));
      return { ok: false, fields: v.fields };
    }
    const result = await runPlan(v.data, await claudeAdapter());

    const db = await dbP;
    if (!db) {
      return { ok: true, plan: { ...result, saveNote: 'Not saved: plans are only kept when this page is opened on claude.ai while signed in.' } };
    }
    const id = newId();
    try {
      await db.collection('plans').doc(id).set(plain({ ...summaryRow(result), input: v.data, result }));
    } catch (e) {
      console.error('save failed', e);
      const user = await userP;
      const canWrite = user ? await user.can('data.write').catch(() => null) : null;
      const why = canWrite === false
        ? 'your access to this page is view-only. Ask the owner for Contributor access to keep plans.'
        : `the page database refused the write (${e?.code || 'unknown error'}).`;
      return { ok: true, plan: { ...result, saveNote: `Not saved: ${why}` } };
    }
    logEvent('plan_saved', `${v.data.productName}: ${result.status}, score ${result.readiness.score}`, id);
    if (result.meta.retried) logEvent('retry', `${result.meta.issuesBeforeRetry} issues in first draft`, id);
    if (result.status === 'ai_error') logEvent('ai_error', result.meta.error, id);
    return { ok: true, plan: { id, ...result } };
  },

  async listPlans(q = '') {
    const rows = (await allRows(300)).filter((r) => r.review_status !== 'archived');
    const needle = q.toLowerCase();
    return needle ? rows.filter((r) => r.product_name.toLowerCase().includes(needle)) : rows;
  },

  async getPlan(id) {
    const db = await requireDb();
    const snap = await db.doc(`plans/${id}`).get();
    if (!snap.exists) return null;
    const d = snap.data();
    return { id: snap.id, createdAt: d.created_at, reviewStatus: d.review_status, feedback: d.feedback, ...d.result };
  },

  async feedback(id, useful) {
    const db = await requireDb();
    await db.doc(`plans/${id}`).update({ feedback: useful ? 1 : -1 });
    return { ok: true };
  },

  canSeeAdmin: canEdit,

  async health() {
    const sample = await sampleP;
    const db = await dbP;
    if (!sample) return { ok: false, text: 'Claude is not available in this view: plans will have no AI copy.' };
    return { ok: true, text: `Claude connected${db ? ' · page database connected' : ' · no database in this view'}` };
  },

  admin: {
    async stats() {
      const db = await requireDb();
      const rows = await allRows(1000);
      const events = (await db.collection('events').orderBy('created_at', 'desc').limit(1000).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
      return computeDashboard({ rows, events, tzOffset: -new Date().getTimezoneOffset(), price: null });
    },
    async plans({ q = '', level = '', status = '', review = '' } = {}) {
      const needle = q.toLowerCase();
      return (await allRows(1000)).filter((r) =>
        (!needle || r.product_name.toLowerCase().includes(needle)) &&
        (!level || r.readiness_level === level) &&
        (!status || r.status === status) &&
        (!review || r.review_status === review));
    },
    async setReview(id, reviewStatus) {
      if (!['new', 'approved', 'archived'].includes(reviewStatus)) throw new Error('Unknown review status.');
      const db = await requireEditor();
      await db.doc(`plans/${id}`).update({ review_status: reviewStatus });
      logEvent('review_status', `set to ${reviewStatus}`, id);
      return { ok: true };
    },
    async remove(id) {
      const db = await requireEditor();
      const name = (await db.doc(`plans/${id}`).get()).data()?.product_name || id;
      await db.doc(`plans/${id}`).delete();
      logEvent('plan_deleted', name);
      return { ok: true };
    },
    async exportCsv() {
      const downloads = await downloadsP;
      if (!downloads) throw new Error('Downloads are not available in this view.');
      const csv = plansCsv(await allRows(1000));
      try {
        await downloads.save({ filename: `campaign-plans-${new Date().toISOString().slice(0, 10)}.csv`, data: csv });
      } catch (e) {
        if (e?.code !== 'cancelled' && e?.code !== 'declined') throw new Error(`Export failed (${e?.code || 'unknown error'}).`);
      }
    },
  },
};

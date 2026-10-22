// How the pages talk to the backend. This is the Node version (fetch to the Express API).
// The Claude-hosted page swaps in claude/api.js, which has the same methods but runs the
// pipeline in the browser, uses Claude as the model and the page's database for storage.
(function () {
  async function call(url, opts) {
    const res = await fetch(url, opts);
    const body = await res.json().catch(() => ({}));
    return { res, body };
  }
  async function must(url, opts) {
    const { res, body } = await call(url, opts);
    if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
    return body;
  }
  const json = (method, data) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

  window.API = {
    links: {
      newPlan: '/',
      plans: '/plans',
      plan: (id) => `/plan?id=${encodeURIComponent(id)}`,
      admin: '/admin',
    },

    // -> { ok: true, plan } | { ok: false, fields } | { ok: false, error }
    async createPlan(data) {
      const { res, body } = await call('/api/plan', json('POST', data));
      if (res.status === 422 && body.fields) return { ok: false, fields: body.fields };
      if (!res.ok) return { ok: false, error: body.error || `Request failed (${res.status})` };
      return { ok: true, plan: body };
    },
    listPlans: (q = '') => must('/api/plans?limit=100&q=' + encodeURIComponent(q)),
    getPlan: (id) => must('/api/plans/' + encodeURIComponent(id)),
    feedback: (id, useful) => must(`/api/plans/${encodeURIComponent(id)}/feedback`, json('POST', { useful })),

    canSeeAdmin: async () => true,
    async health() {
      const h = await must('/api/health');
      return { ok: h.llm, text: h.llm ? `Gemini key set · model ${h.model}` : 'No GEMINI_API_KEY set: plans will have no AI copy' };
    },
    admin: {
      stats: () => must('/api/admin/stats?tz=' + -new Date().getTimezoneOffset()),
      plans: (filters) => must('/api/admin/plans?' + new URLSearchParams(filters)),
      setReview: (id, reviewStatus) => must(`/api/admin/plans/${encodeURIComponent(id)}`, json('PATCH', { reviewStatus })),
      remove: (id) => must(`/api/admin/plans/${encodeURIComponent(id)}`, { method: 'DELETE' }),
      async exportCsv() { location.href = '/api/admin/export.csv'; },
    },
  };
})();

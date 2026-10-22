// Admin dashboard. Admin.init() is called by admin.html (Node) or by the #admin route (Claude page).
(function () {
  const { esc, inr, when, label, LEVEL, BUSINESS } = window.Render;
  const $ = (id) => document.getElementById(id);
  const int = (n) => Math.round(n || 0).toLocaleString('en-IN');
  const share = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '–');
  const STATUS = { complete: ['AI complete', 'ok'], ai_error: ['AI failed', 'bad'], no_key: ['AI not available', 'plain'] };
  const REVIEW = { new: 'New', approved: 'Approved', archived: 'Archived' };
  const EVENT = {
    plan_saved: 'Plan saved', retry: 'Copy sent back once', ai_error: 'AI error', validation_failed: 'Form rejected',
    rate_limited: 'Rate limited', review_status: 'Review status', plan_deleted: 'Plan deleted',
  };

  function showError(msg) {
    $('admin-alert').innerHTML = '<div class="alert err"></div>';
    $('admin-alert').firstChild.textContent = msg;
  }

  const planLink = (id) => esc(window.API.links.plan(id));

  function hbars(rows, total) {
    if (!rows.length) return '<p class="empty small">Nothing yet.</p>';
    const max = Math.max(...rows.map((r) => r.n), 1);
    return `<table class="hbars">${rows
      .map((r) => `<tr><td>${esc(r.name)}</td><td class="bar-cell"><div class="hbar ${r.cls || ''}" style="width:${(r.n / max) * 100}%"></div></td>
        <td class="r num">${int(r.n)}${total ? ` <span class="muted">${share(r.n, total)}</span>` : ''}</td></tr>`)
      .join('')}</table>`;
  }

  function renderStats(s) {
    const t = s.totals;
    const answered = t.useful + t.notUseful;
    const kpi = (k, v, sub) => `<div class="stat"><span class="stat-k">${k}</span><span class="stat-v num">${v}</span><span class="small muted">${sub}</span></div>`;
    $('kpis').innerHTML = [
      kpi('Plans', int(t.plans), `${int(t.last7)} in the last 7 days`),
      kpi('AI success rate', share(t.complete, t.plans), `${int(t.aiErrors)} failed, ${int(t.noKey)} without AI`),
      kpi('Avg. readiness', t.avgScore || '–', `${int(t.ready)} ready to launch`),
      kpi('Sent back for fixes', share(t.retried, t.complete), 'drafts that failed the copy checks once'),
      kpi('Avg. AI time', t.avgLatency ? `${(t.avgLatency / 1000).toFixed(1)}s` : '–', 'complete plans only'),
      t.costInr === null
        ? kpi('AI cost', '₹0', "runs on each viewer's own Claude plan")
        : kpi('AI cost so far', `₹${t.costInr.toFixed(2)}`, `₹${t.costPerPlanInr.toFixed(2)} per plan · ${int(t.tokensIn + t.tokensOut)} tokens`),
    ].join('');

    $('kpis').insertAdjacentHTML('afterend', `<p class="small muted kpi-note">
      Feedback: ${answered ? `${share(t.useful, answered)} useful (${int(answered)} answers)` : 'no answers yet'} ·
      ${int(t.approved)} approved by an admin ·
      ${int(t.withBlockedTests)} plans had an A/B test the budget can't support ·
      ${int(s.validationFails7)} form submissions rejected in 7 days ·
      ${s.price ? `Cost uses $${s.price.inPerM}/M input and $${s.price.outPerM}/M output tokens at ₹${s.price.usdToInr}/$.` : "Claude calls run on the viewer's plan, so there is no per-token bill."}</p>`);

    const maxDay = Math.max(...s.days.map((d) => d.plans), 1);
    $('days').innerHTML = s.days
      .map((d) => {
        const ok = d.plans - d.failed;
        const date = new Date(d.day + 'T00:00:00');
        return `<div class="day" title="${esc(d.day)}: ${d.plans} plans, ${d.failed} without AI copy">
          <div class="day-bars"><div class="seg fail" style="height:${(d.failed / maxDay) * 100}%"></div><div class="seg" style="height:${(ok / maxDay) * 100}%"></div></div>
          <span class="day-n num">${d.plans || ''}</span>
          <span class="day-l">${date.getDate()}</span></div>`;
      })
      .join('');

    $('levels').innerHTML = hbars(
      ['ready', 'review', 'rework'].map((k) => ({ name: LEVEL[k][0], n: t[k], cls: LEVEL[k][1] })),
      t.plans
    );
    $('channels').innerHTML = hbars(s.channels.map((c) => ({ name: label(c.key), n: c.n })), t.plans) +
      `<p class="small muted">Business types: ${s.business.map((b) => `${esc(BUSINESS[b.key] || b.key)} ${b.n}`).join(', ') || '–'}</p>`;
    $('issues').innerHTML = s.issues.length
      ? `<table class="hbars">${s.issues.map((i) => {
          const max = s.issues[0].total;
          return `<tr><td>${esc(i.name)}</td><td class="bar-cell"><div class="hbar-stack" style="width:${(i.total / max) * 100}%">
            <div class="hbar bad" style="flex:${i.error}"></div><div class="hbar warn" style="flex:${i.warn}"></div></div></td>
            <td class="r num">${i.total}</td></tr>`;
        }).join('')}</table><p class="small muted"><span class="key bad"></span> must fix <span class="key warn"></span> warning</p>`
      : '<p class="empty small">No problems logged yet.</p>';

    $('events').innerHTML = s.events.length
      ? `<table class="data events"><tbody>${s.events.map((e) => `<tr>
          <td class="small muted nowrap">${esc(when(e.created_at))}</td>
          <td class="small"><span class="chip ${e.kind === 'ai_error' ? 'bad' : e.kind === 'retry' || e.kind === 'validation_failed' ? 'warn' : 'plain'}">${esc(EVENT[e.kind] || e.kind)}</span></td>
          <td class="small">${e.plan_id ? `<a href="${planLink(e.plan_id)}">plan</a> ` : ''}${esc(e.detail || '')}</td></tr>`).join('')}</tbody></table>`
      : '<p class="empty small">No events yet.</p>';
  }

  async function loadStats() {
    document.querySelectorAll('.kpi-note').forEach((n) => n.remove());
    renderStats(await window.API.admin.stats());
  }

  async function loadPlans() {
    const rows = await window.API.admin.plans({ q: $('f-q').value.trim(), level: $('f-level').value, status: $('f-status').value, review: $('f-review').value });
    if (!rows.length) {
      $('plans').innerHTML = '<p class="empty">No plans match these filters.</p>';
      return;
    }
    $('plans').innerHTML = `<table class="data admin-plans"><thead><tr>
        <th>Product</th><th>Readiness</th><th>AI</th><th class="r">Checks</th><th class="r">Time</th><th>Feedback</th><th>Review</th><th></th></tr></thead><tbody>
      ${rows.map((r) => `<tr class="${r.review_status === 'archived' ? 'archived' : ''}">
        <td><a href="${planLink(r.id)}"><strong>${esc(r.product_name)}</strong></a>
          <div class="small muted">${esc(BUSINESS[r.business_type] || '')} · ${inr(r.budget)} · ${esc(when(r.created_at))}</div></td>
        <td><span class="num">${r.readiness_score}</span> <span class="chip ${LEVEL[r.readiness_level][1]}">${LEVEL[r.readiness_level][0]}</span></td>
        <td><span class="chip ${STATUS[r.status][1]}">${STATUS[r.status][0]}</span>${r.retried ? '<span class="chip warn">retried</span>' : ''}</td>
        <td class="r small"><span class="${r.error_count ? 'flag' : ''}">${r.error_count} err</span> · ${r.warn_count} warn</td>
        <td class="r small num">${r.latency_ms ? (r.latency_ms / 1000).toFixed(1) + 's' : '–'}</td>
        <td class="small">${r.feedback === 1 ? 'Useful' : r.feedback === -1 ? 'Not useful' : '–'}</td>
        <td><select class="review" data-id="${r.id}">${Object.entries(REVIEW).map(([k, v]) => `<option value="${k}" ${k === r.review_status ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
        <td><button type="button" class="ghost small del" data-id="${r.id}" data-name="${esc(r.product_name)}">Delete</button></td>
      </tr>`).join('')}</tbody></table>`;

    $('plans').querySelectorAll('select.review').forEach((sel) =>
      sel.addEventListener('change', async () => {
        try {
          await window.API.admin.setReview(sel.dataset.id, sel.value);
          await Promise.all([loadPlans(), loadStats()]);
        } catch (e) { showError(e.message); }
      })
    );
    $('plans').querySelectorAll('button.del').forEach((b) =>
      b.addEventListener('click', async () => {
        // Two clicks instead of confirm(): dialogs are blocked inside claude.ai.
        if (!b.classList.contains('danger')) {
          b.classList.add('danger');
          b.textContent = 'Confirm delete';
          setTimeout(() => { b.classList.remove('danger'); b.textContent = 'Delete'; }, 4000);
          return;
        }
        try {
          await window.API.admin.remove(b.dataset.id);
          await Promise.all([loadPlans(), loadStats()]);
        } catch (e) { showError(e.message); }
      })
    );
  }

  async function loadHealth() {
    try {
      const h = await window.API.health();
      $('health').innerHTML = h.ok ? esc(h.text) : `<span class="flag">${esc(h.text)}</span>`;
    } catch {
      $('health').textContent = 'Could not check the AI connection.';
    }
  }

  async function loadAll() {
    $('admin-alert').innerHTML = '';
    try {
      await Promise.all([loadStats(), loadPlans(), loadHealth()]);
    } catch (e) {
      showError(e.message);
    }
  }

  let wired = false;
  function init() {
    if (!wired) {
      wired = true;
      let t;
      $('f-q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => loadPlans().catch((e) => showError(e.message)), 250); });
      ['f-level', 'f-status', 'f-review'].forEach((id) => $(id).addEventListener('change', () => loadPlans().catch((e) => showError(e.message))));
      $('refresh').addEventListener('click', loadAll);
      $('export').addEventListener('click', () => window.API.admin.exportCsv().catch((e) => showError(e.message)));
    }
    loadAll();
  }

  window.Admin = { init };
})();

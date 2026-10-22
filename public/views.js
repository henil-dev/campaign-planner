// Saved-plans list and single saved plan. Used by plans.html / plan.html on the Node app
// and by the hash routes on the Claude page.
(function () {
  const { esc, inr, when, LEVEL, BUSINESS, label, renderPlan, wireCopyButtons, wireFeedback } = window.Render;
  const channelNames = (c) => (Array.isArray(c) ? c : String(c || '').split(',').filter(Boolean)).map(label).map(esc).join(', ');

  async function plansList(list, q = '') {
    try {
      const rows = await window.API.listPlans(q);
      if (!rows.length) {
        list.innerHTML = `<p class="empty">${q ? 'No plans match that name.' : `No plans yet. <a href="${window.API.links.newPlan}">Make the first one.</a>`}</p>`;
        return;
      }
      list.innerHTML = `<table class="data"><thead><tr>
          <th>Product</th><th>Channels</th><th class="r">Budget</th><th>Readiness</th><th>Created</th></tr></thead><tbody>
        ${rows.map((r) => `<tr class="link-row" data-href="${esc(window.API.links.plan(r.id))}">
          <td><a href="${esc(window.API.links.plan(r.id))}"><strong>${esc(r.product_name)}</strong></a><div class="small muted">${esc(BUSINESS[r.business_type] || '')}</div></td>
          <td class="small">${channelNames(r.channels)}</td>
          <td class="r num">${inr(r.budget)}</td>
          <td><span class="num">${r.readiness_score}</span> <span class="chip ${LEVEL[r.readiness_level][1]}">${LEVEL[r.readiness_level][0]}</span>
            ${r.status !== 'complete' ? '<span class="chip plain">no AI copy</span>' : ''}</td>
          <td class="small muted">${esc(when(r.created_at))}</td></tr>`).join('')}
        </tbody></table>`;
      list.querySelectorAll('tr.link-row').forEach((tr) => tr.addEventListener('click', (e) => {
        if (e.target.tagName !== 'A') location.href = tr.dataset.href;
      }));
    } catch (err) {
      list.innerHTML = '<p class="empty"></p>';
      list.firstChild.textContent = err.message || 'Could not load saved plans. Refresh to try again.';
    }
  }

  function wireSearch(input, list) {
    let t;
    input.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => plansList(list, input.value.trim()), 250);
    });
  }

  async function savedPlan(view, id) {
    if (!id) {
      view.innerHTML = `<div class="alert err">No plan in the link. <a href="${window.API.links.plans}">See all saved plans.</a></div>`;
      return;
    }
    view.innerHTML = '<p class="muted">Loading…</p>';
    try {
      const plan = await window.API.getPlan(id);
      if (!plan) throw new Error('No saved plan with that id.');
      document.title = `${plan.input.productName} · Campaign Planner`;
      view.innerHTML = renderPlan(plan, {
        id,
        savedAt: when(plan.createdAt),
        actions: `<a class="btn ghost" href="${window.API.links.plans}">All plans</a>${window.API.canPrint ? '<button type="button" class="ghost" onclick="window.print()">Print</button>' : ''}`,
      });
      wireCopyButtons(view);
      wireFeedback(view);
    } catch (err) {
      view.innerHTML = '<div class="alert err"></div>';
      view.firstChild.textContent = err.message;
    }
  }

  window.Views = { plansList, wireSearch, savedPlan };
})();

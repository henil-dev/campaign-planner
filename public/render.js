// Turns a plan result from the API into HTML. Used by the form page and the saved-plan page.
(function () {
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inr = (n) => (n === null || n === undefined || !isFinite(n) ? '–' : '₹' + Math.round(n).toLocaleString('en-IN'));
  const int = (n) => Math.round(n).toLocaleString('en-IN');
  // SQLite stores UTC as 'YYYY-MM-DD HH:MM:SS'; show it in the viewer's time zone.
  const when = (s) => new Date(s.replace(' ', 'T') + 'Z').toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const pct = (n, d = 1) => `${(n * 100).toFixed(d)}%`;

  const CHANNEL_LABELS = {
    google_search: 'Google Search',
    meta: 'Instagram & Facebook',
    youtube: 'YouTube',
    linkedin: 'LinkedIn',
    influencers: 'Creators / influencers',
    communities: 'Reddit & Quora',
  };
  const LIMITS = {
    google_search: { headline: 30, body: 90 },
    meta: { headline: 40, body: 125 },
    youtube: { headline: 50 },
    linkedin: { headline: 70, body: 150 },
    influencers: { headline: 80 },
    communities: { headline: 120 },
  };
  const BUSINESS = {
    b2b_saas: 'B2B software', d2c: 'D2C brand', consumer_app: 'Consumer app', education: 'Education',
    local: 'Local business', finance: 'Finance', health: 'Health & wellness',
  };
  const GOALS = { awareness: 'reach', leads: 'leads', sales: 'online sales', installs: 'app installs' };
  const RESULT_WORD = { awareness: 'visits', leads: 'leads', sales: 'sales', installs: 'installs' };
  const METRICS = { ctr: 'click-through rate', conversion_rate: 'conversion rate', cost_per_result: 'cost per result' };
  const LEVEL = { ready: ['Ready to launch', 'ok'], review: ['Review flagged items', 'warn'], rework: ['Needs rework', 'bad'] };
  const label = (k) => CHANNEL_LABELS[k] || k || '–';

  function part(n, title, who, note = '') {
    return `<h2 class="part"><span class="num">${n}</span>${esc(title)}<span class="who ${who}">${who === 'rules' ? 'rules' : 'AI'}</span>${note ? `<span class="muted">${esc(note)}</span>` : ''}</h2>`;
  }

  // Forecasts are benchmark-based; show them as a ±30% range so they don't read as promises.
  const range = (n) => (n < 1 ? '<1' : `${int(n * 0.7)}–${int(n * 1.3)}`);

  function header(r, opts) {
    const i = r.input;
    const bits = [BUSINESS[i.businessType], `${inr(i.budget)}/month`, `${i.weeks} weeks`, `goal: ${GOALS[i.goal] || i.goal}`];
    return `
      <div class="result-head">
        <div>
          <p class="small muted">${opts.savedAt ? `Saved plan #${esc(opts.id)} · ${esc(opts.savedAt)}` : 'Campaign plan'}</p>
          <h1>${esc(i.productName)}</h1>
          <p class="muted small">${bits.filter(Boolean).map(esc).join(' · ')}</p>
        </div>
        <div class="actions">${opts.actions || ''}</div>
      </div>`;
  }

  function statusAlert(r) {
    if (r.status === 'no_key') {
      return `<div class="alert warn"><strong>The AI step was skipped.</strong> No Gemini API key is set on the server. The channel plan, budget and test sizing below come from the rules and are complete; ideas and ad copy are missing.</div>`;
    }
    if (r.status === 'ai_error') {
      return `<div class="alert err"><strong>The AI step failed:</strong> ${esc(r.meta?.error || '')}<br>The channel plan, budget and test sizing below still came from the rules. Try again in a minute for the copy.</div>`;
    }
    return '';
  }

  function summary(r) {
    const t = r.channelPlan.totals;
    const goal = r.input.goal;
    const [lvlText, lvlClass] = LEVEL[r.readiness.level];
    const cells = [
      `<div class="stat"><span class="stat-k">Readiness</span><span class="stat-v num">${r.readiness.score}<small>/100</small></span><span class="chip ${lvlClass}">${lvlText}</span></div>`,
      `<div class="stat"><span class="stat-k">Channels</span><span class="stat-v">${r.channelPlan.channels.length}</span><span class="small muted">${r.channelPlan.channels.map((c) => esc(c.label)).join(', ')}</span></div>`,
    ];
    if (goal === 'awareness') {
      cells.push(`<div class="stat"><span class="stat-k">Est. impressions / month</span><span class="stat-v num">${range(t.impressions)}</span><span class="small muted">${inr((r.input.budget / t.impressions) * 1000)} per 1,000</span></div>`);
    } else {
      cells.push(`<div class="stat"><span class="stat-k">Est. ${RESULT_WORD[goal]} / month</span><span class="stat-v num">${range(t.results)}</span><span class="small muted">about ${inr(t.costPerResult)} each</span></div>`);
    }
    if (t.roas !== undefined) {
      cells.push(`<div class="stat"><span class="stat-k">Est. return on ad spend</span><span class="stat-v num">${t.roas.toFixed(1)}×</span><span class="small muted">revenue ÷ spend</span></div>`);
    } else if (t.costPerCustomer !== undefined) {
      cells.push(`<div class="stat"><span class="stat-k">Est. cost per customer</span><span class="stat-v num">${inr(t.costPerCustomer)}</span><span class="small muted">if 1 in 10 leads buys</span></div>`);
    } else {
      cells.push(`<div class="stat"><span class="stat-k">Est. clicks / month</span><span class="stat-v num">${range(t.clicks)}</span><span class="small muted">across all channels</span></div>`);
    }
    return `<div class="stats">${cells.join('')}</div>`;
  }

  function channelPlan(r) {
    const p = r.channelPlan;
    const goal = r.input.goal;
    const rows = p.channels
      .map(
        (c) => `<tr>
          <td><strong>${esc(c.label)}</strong><div class="small muted">${c.reasons.map(esc).join('; ')}</div></td>
          <td class="r num">${c.score}</td>
          <td class="r"><span class="num">${inr(c.budget)}</span><div class="bar" style="width:${Math.round(c.share * 100)}%"></div><span class="small muted">${Math.round(c.share * 100)}%</span></td>
          <td class="r num">${range(c.forecast.clicks)}</td>
          <td class="r num">${goal === 'awareness' ? range(c.forecast.impressions) : range(c.forecast.results)}</td>
          <td class="r num">${goal === 'awareness' ? inr((c.budget / c.forecast.impressions) * 1000) : inr(c.forecast.costPerResult)}</td>
        </tr>`
      )
      .join('');
    const skipped = p.skipped.length
      ? `<p class="small muted skipped"><strong>Not used:</strong> ${p.skipped.map((s) => `${esc(s.label)} (fit ${s.score}, ${esc(s.why)})`).join('; ')}.</p>`
      : '';
    const notes = p.notes.map((n) => `<div class="alert warn small">${esc(n)}</div>`).join('');
    return `
      ${notes}
      <div class="block">
        <table class="data">
          <thead><tr><th>Channel and why</th><th class="r">Fit</th><th class="r">Budget / month</th><th class="r">Clicks</th>
            <th class="r">${goal === 'awareness' ? 'Impressions' : esc(RESULT_WORD[goal][0].toUpperCase() + RESULT_WORD[goal].slice(1))}</th>
            <th class="r">${goal === 'awareness' ? 'Per 1,000' : 'Cost each'}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${skipped}
        <p class="small muted">Estimates use fixed benchmark rates per channel and category, shown as a ±30% range. Real numbers depend on the creative and landing page.</p>
      </div>`;
  }

  function positioning(ai) {
    return `
      <div class="block">
        <p class="big-line">${esc(ai.positioning.oneLiner)}</p>
        <p class="muted small"><strong>Audience insight:</strong> ${esc(ai.positioning.audienceInsight)}</p>
      </div>`;
  }

  function ideas(ai) {
    return `<div class="cards">${ai.ideas
      .map(
        (x, n) => `
        <div class="card">
          <p class="small muted">Idea ${n + 1}${x.bestOn ? ` · best on ${esc(label(x.bestOn))}` : ''}</p>
          <h3>${esc(x.name)}</h3>
          <p>${esc(x.concept)}</p>
          <p class="small muted">${esc(x.whyItFits)}</p>
        </div>`
      )
      .join('')}</div>`;
  }

  function counter(text, max) {
    if (!max) return '';
    const over = text.length > max;
    return `<span class="count ${over ? 'over' : ''}">${text.length}/${max}</span>`;
  }

  function issueChips(list) {
    return list.map((i) => `<span class="chip ${i.level === 'error' ? 'bad' : 'warn'}">${esc(i.text)}</span>`).join('');
  }

  function variant(channel, v, issues) {
    const lim = LIMITS[channel] || {};
    const mine = issues.filter((i) => i.channel === channel && i.variant === v.label);
    return `
      <div class="variant ${mine.some((i) => i.level === 'error') ? 'has-error' : ''}">
        <div class="variant-head">
          <span class="tag">${esc(v.label)}</span>
          <span class="small muted">${esc(v.angle)}</span>
          <button type="button" class="ghost small copy" data-copy="${esc(`${v.headline}\n\n${v.body}\n\n${v.cta}`)}">Copy</button>
        </div>
        <p class="ad-headline">${esc(v.headline)} ${counter(v.headline, lim.headline)}</p>
        <p class="ad-body">${esc(v.body)} ${counter(v.body, lim.body)}</p>
        <p class="ad-cta">${esc(v.cta)}</p>
        ${mine.length ? `<div class="issues">${issueChips(mine)}</div>` : '<div class="issues"><span class="chip ok">Passed checks</span></div>'}
      </div>`;
  }

  function ads(r) {
    const ai = r.ai;
    return r.channelPlan.channels
      .map((c) => {
        const ad = ai.ads.find((a) => a.channel === c.key);
        const general = r.issues.filter((i) => i.channel === c.key && !i.variant);
        return `
        <div class="block">
          <div class="block-head"><h3>${esc(c.label)}</h3><span class="small muted num">${inr(c.budget)}/month</span></div>
          ${general.length ? `<div class="issues top">${issueChips(general)}</div>` : ''}
          ${ad ? `<div class="variants">${ad.variants.map((v) => variant(c.key, v, r.issues)).join('')}</div>` : ''}
        </div>`;
      })
      .join('');
  }

  function weeksText(w) {
    if (w > 52) return 'over a year';
    if (w < 1) return 'under a week';
    return `${w} wk${w === 1 ? '' : 's'}`;
  }

  function tests(r) {
    const rows = r.tests
      .map(
        (t) => `<tr>
          <td class="num muted">${t.priority}</td>
          <td><strong>${esc(label(t.channel))}</strong>, ${esc((t.variable || '').replace('_', ' '))}${t.fromRules ? ' <span class="chip plain">default test</span>' : ''}
            <div class="small muted">${esc(t.hypothesis)}</div>
            <div class="small ab"><span class="tag">A</span> ${esc(t.variantA)}<br><span class="tag">B</span> ${esc(t.variantB)}</div></td>
          <td class="small">${esc(METRICS[t.metric] || t.metric)}<div class="muted">baseline ${pct(t.baseline)}</div></td>
          <td class="r small"><span class="num">${int(t.perVariant)}</span><div class="muted">${esc(t.unit)} per version</div></td>
          <td class="r small num">${weeksText(t.weeksNeeded)}</td>
          <td class="small"><span class="chip ${t.feasible ? 'ok' : 'warn'}">${t.feasible ? 'Fits the campaign' : 'Not enough traffic'}</span><div class="muted">${esc(t.verdict)}</div></td>
        </tr>`
      )
      .join('');
    return `
      <div class="block">
        <table class="data tests">
          <thead><tr><th>#</th><th>Test</th><th>Measure</th><th class="r">Sample needed</th><th class="r">Time needed</th><th>Verdict</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="small muted">Sample size for a two-sided test at 95% confidence and 80% power, to detect a 20% relative change. Traffic comes from the channel's budget above; tests on the same channel run one after another.</p>
      </div>`;
  }

  function readinessBlock(r) {
    const d = r.readiness.deductions;
    return `
      <div class="block">
        <div class="score-line"><span class="num big">${r.readiness.score}</span><span class="muted">/100 · starts at 100, points come off for each problem below</span></div>
        ${d.length
          ? `<table class="data"><tbody>${d.map((x) => `<tr><td class="num r deduct">−${x.points}</td><td>${esc(x.reason)}</td></tr>`).join('')}</tbody></table>`
          : '<p>No problems found.</p>'}
        ${r.meta?.retried ? `<p class="small muted">The first draft had ${r.meta.issuesBeforeRetry} issue${r.meta.issuesBeforeRetry === 1 ? '' : 's'}, so it was sent back to the model once with the problems listed. What you see is the better of the two drafts.</p>` : ''}
      </div>`;
  }

  function assumptions(ai) {
    return `<div class="block"><ul class="plain-list">${ai.assumptions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>`;
  }

  function footerMeta(r) {
    const m = r.meta || {};
    const bits = [];
    if (m.model && r.ai) bits.push(`Model: ${m.model}`);
    if (m.tokensIn || m.tokensOut) bits.push(`${int(m.tokensIn + m.tokensOut)} tokens`);
    if (m.retried) bits.push('1 retry');
    if (m.latencyMs) bits.push(`${(m.latencyMs / 1000).toFixed(1)}s`);
    return bits.length ? `<p class="small muted meta-line">${esc(bits.join(' · '))}</p>` : '';
  }

  function renderPlan(r, opts = {}) {
    let html = header(r, opts) + statusAlert(r) + summary(r);
    const ai = r.ai;
    let n = 0;
    const next = () => String(++n).padStart(2, '0');
    html += part(next(), 'Channels and budget', 'rules') + channelPlan(r);
    if (ai) {
      html += part(next(), 'Positioning', 'ai') + positioning(ai);
      html += part(next(), 'Campaign ideas', 'ai') + ideas(ai);
      html += part(next(), 'Ad copy', 'ai', 'two versions per channel, checked against length limits, risky claims and filler words') + ads(r);
    }
    html += part(next(), 'A/B test plan', 'rules', ai ? 'tests from the AI, sized by the rules' : '') + tests(r);
    html += part(next(), 'Readiness score', 'rules') + readinessBlock(r);
    if (ai?.assumptions?.length) html += part(next(), 'Check before launch', 'ai') + assumptions(ai);
    if (r.id) html += feedback(r);
    html += footerMeta(r);
    return html;
  }

  function feedback(r) {
    const given = r.feedback === 1 ? 'Marked as useful.' : r.feedback === -1 ? 'Marked as not useful.' : '';
    return `
      <div class="feedback" data-id="${esc(r.id)}">
        <span>Was this plan useful?</span>
        <button type="button" class="ghost small" data-useful="1">Yes</button>
        <button type="button" class="ghost small" data-useful="0">No</button>
        <span class="small muted fb-msg">${given}</span>
      </div>`;
  }

  function wireFeedback(root) {
    const box = root.querySelector('.feedback');
    if (!box) return;
    box.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', async () => {
        const msg = box.querySelector('.fb-msg');
        try {
          const res = await fetch(`/api/plans/${box.dataset.id}/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ useful: b.dataset.useful === '1' }),
          });
          if (!res.ok) throw new Error();
          msg.textContent = 'Thanks, saved.';
        } catch {
          msg.textContent = 'Could not save that. Try again.';
        }
      })
    );
  }

  function wireCopyButtons(root) {
    root.querySelectorAll('button.copy').forEach((b) =>
      b.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(b.dataset.copy);
          b.textContent = 'Copied';
        } catch {
          b.textContent = 'Copy failed';
        }
        setTimeout(() => (b.textContent = 'Copy'), 1500);
      })
    );
  }

  window.Render = { renderPlan, wireCopyButtons, wireFeedback, esc, inr, when, label, LEVEL, GOALS, BUSINESS };

  // On the form page: swap the form for the result.
  window.showPlan = function (r) {
    const view = document.getElementById('result-view');
    const formView = document.getElementById('form-view');
    if (!view) return;
    view.innerHTML = renderPlan(r, {
      actions: `${r.id ? `<a class="btn ghost" href="/plan?id=${r.id}">Saved as #${r.id}</a>` : ''}<button type="button" class="ghost" id="edit-btn">Edit inputs</button><button type="button" id="new-btn">New plan</button>`,
    });
    wireCopyButtons(view);
    wireFeedback(view);
    formView.hidden = true;
    view.hidden = false;
    window.scrollTo(0, 0);
    view.querySelector('#edit-btn').onclick = () => { view.hidden = true; formView.hidden = false; };
    view.querySelector('#new-btn').onclick = () => {
      document.getElementById('plan-form').reset();
      view.hidden = true;
      formView.hidden = false;
    };
  };
})();

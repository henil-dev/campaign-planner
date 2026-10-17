// Turns a plan result from the API into HTML. Used by the form page and the saved-plan page.
(function () {
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inr = (n) => (n === null || n === undefined ? '–' : '₹' + Math.round(n).toLocaleString('en-IN'));

  const CHANNEL_LABELS = {
    google_search: 'Google Search',
    meta: 'Instagram & Facebook',
    youtube: 'YouTube',
    linkedin: 'LinkedIn',
    influencers: 'Creators / influencers',
    communities: 'Reddit & Quora',
  };
  const BUSINESS = {
    b2b_saas: 'B2B software',
    d2c: 'D2C brand',
    consumer_app: 'Consumer app',
    education: 'Education',
    local: 'Local business',
    finance: 'Finance',
    health: 'Health & wellness',
  };
  const GOALS = { awareness: 'reach', leads: 'leads', sales: 'online sales', installs: 'app installs' };
  const METRICS = { ctr: 'Click-through rate', conversion_rate: 'Conversion rate', cost_per_result: 'Cost per result' };
  const label = (k) => CHANNEL_LABELS[k] || k || '–';

  function part(n, title, note = '') {
    return `<h2 class="part"><span class="num">${n}</span>${esc(title)}${note ? `<span class="muted">${esc(note)}</span>` : ''}</h2>`;
  }

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
      return `<div class="alert warn"><strong>The AI step was skipped.</strong> No Gemini API key is set on the server, so there is no copy or ideas below.</div>`;
    }
    if (r.status === 'ai_error') {
      return `<div class="alert err"><strong>The AI step failed.</strong> ${esc(r.meta?.error || '')}<br>Try again in a minute.</div>`;
    }
    return '';
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

  function channelsSimple(ai) {
    if (!ai.channels?.length) return '';
    return `<div class="block"><table class="data"><thead><tr><th>Channel</th><th>Why</th></tr></thead><tbody>${ai.channels
      .map((c) => `<tr><td><strong>${esc(label(c.channel))}</strong></td><td>${esc(c.why)}</td></tr>`)
      .join('')}</tbody></table></div>`;
  }

  function variant(v) {
    return `
      <div class="variant">
        <div class="variant-head">
          <span class="tag">${esc(v.label)}</span>
          <span class="small muted">${esc(v.angle)}</span>
          <button type="button" class="ghost small copy" data-copy="${esc(`${v.headline}\n\n${v.body}\n\n${v.cta}`)}">Copy</button>
        </div>
        <p class="ad-headline">${esc(v.headline)}</p>
        <p class="ad-body">${esc(v.body)}</p>
        <p class="ad-cta">${esc(v.cta)}</p>
      </div>`;
  }

  function ads(ai) {
    return ai.ads
      .map(
        (a) => `
        <div class="block">
          <div class="block-head"><h3>${esc(label(a.channel))}</h3></div>
          <div class="variants">${a.variants.map((v) => variant(v)).join('')}</div>
        </div>`
      )
      .join('');
  }

  function tests(ai) {
    return `<div class="block"><table class="data"><thead><tr><th>Test</th><th>A</th><th>B</th><th>Measure</th></tr></thead><tbody>${ai.tests
      .map(
        (t) => `<tr>
          <td><strong>${esc(label(t.channel))}</strong>, ${esc((t.variable || '').replace('_', ' '))}<br><span class="small muted">${esc(t.hypothesis)}</span></td>
          <td>${esc(t.variantA)}</td><td>${esc(t.variantB)}</td>
          <td class="small">${esc(METRICS[t.metric] || t.metric)}</td></tr>`
      )
      .join('')}</tbody></table></div>`;
  }

  function assumptions(ai) {
    if (!ai.assumptions.length) return '';
    return `<div class="block"><ul class="plain-list">${ai.assumptions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>`;
  }

  function footerMeta(r) {
    const m = r.meta || {};
    const bits = [];
    if (m.model) bits.push(`Model: ${m.model}`);
    if (m.tokensIn || m.tokensOut) bits.push(`${m.tokensIn + m.tokensOut} tokens`);
    if (m.latencyMs) bits.push(`${(m.latencyMs / 1000).toFixed(1)}s`);
    return bits.length ? `<p class="small muted meta-line">${esc(bits.join(' · '))}</p>` : '';
  }

  function renderPlan(r, opts = {}) {
    let html = header(r, opts) + statusAlert(r);
    const ai = r.ai;
    let n = 0;
    const next = () => String(++n).padStart(2, '0');
    if (ai) {
      html += part(next(), 'Positioning') + positioning(ai);
      html += part(next(), 'Campaign ideas') + ideas(ai);
      if (ai.channels) html += part(next(), 'Channels') + channelsSimple(ai);
      html += part(next(), 'Ad copy', 'two variants per channel, written to be tested against each other') + ads(ai);
      html += part(next(), 'A/B tests') + tests(ai);
      if (ai.assumptions.length) html += part(next(), 'Check before launch') + assumptions(ai);
    }
    html += footerMeta(r);
    return html;
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

  window.Render = { renderPlan, wireCopyButtons, esc, inr, label };

  // On the form page: swap the form for the result.
  window.showPlan = function (r) {
    const view = document.getElementById('result-view');
    const formView = document.getElementById('form-view');
    if (!view) return;
    view.innerHTML = renderPlan(r, {
      actions: '<button type="button" class="ghost" id="edit-btn">Edit inputs</button><button type="button" id="new-btn">New plan</button>',
    });
    wireCopyButtons(view);
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

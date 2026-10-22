// Form handling: examples, counters, client-side checks, submit.
// The server repeats every check; these are only here so people get feedback before a round trip.
(function () {
  const form = document.getElementById('plan-form');
  const alertBox = document.getElementById('form-alert');
  const statusEl = document.getElementById('status');
  const submitBtn = document.getElementById('submit-btn');

  const toNumber = (v) => Number(String(v || '').replace(/[,\s₹]/g, ''));

  function readForm() {
    const fd = new FormData(form);
    const get = (k) => (fd.get(k) || '').toString().trim();
    return {
      productName: get('productName'),
      businessType: get('businessType'),
      description: get('description'),
      audience: get('audience'),
      goal: get('goal'),
      budget: toNumber(get('budget')),
      weeks: Number(get('weeks')),
      market: get('market'),
      orderValue: get('orderValue') ? toNumber(get('orderValue')) : null,
      tone: get('tone'),
      avoid: get('avoid'),
    };
  }

  function check(d) {
    const errs = {};
    if (d.productName.length < 2) errs.productName = 'Add the product or brand name.';
    if (!d.businessType) errs.businessType = 'Pick the type of business.';
    if (d.description.length < 30) errs.description = 'Say a bit more (at least 30 characters): what it is, the price, what is different.';
    if (d.audience.length < 20) errs.audience = 'Describe the audience in at least 20 characters.';
    if (!d.goal) errs.goal = 'Pick one main goal.';
    if (!Number.isFinite(d.budget) || d.budget < 5000) errs.budget = 'Budget must be at least ₹5,000 a month.';
    else if (d.budget > 5000000) errs.budget = 'Budgets above ₹50 lakh a month are out of range for this tool.';
    if (d.orderValue !== null && (!Number.isFinite(d.orderValue) || d.orderValue < 50)) errs.orderValue = 'Enter a number of at least 50, or leave it empty.';
    return errs;
  }

  function clearErrors() {
    form.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
    form.querySelectorAll('.err-text').forEach((el) => el.remove());
    document.getElementById('goal-choices').classList.remove('invalid-group');
    alertBox.innerHTML = '';
  }

  function showErrors(errs) {
    for (const [name, msg] of Object.entries(errs)) {
      const target = name === 'goal' ? document.getElementById('goal-choices') : form.elements[name];
      if (!target) continue;
      if (name === 'goal') target.classList.add('invalid-group');
      else target.classList.add('invalid');
      const p = document.createElement('div');
      p.className = 'err-text';
      p.textContent = msg;
      (name === 'goal' ? target : target.closest('.field')).appendChild(p);
    }
    const first = form.querySelector('.invalid, .invalid-group');
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function fill(ex) {
    clearErrors();
    for (const [k, v] of Object.entries(ex)) {
      if (k === 'goal') {
        const r = form.querySelector(`input[name="goal"][value="${v}"]`);
        if (r) r.checked = true;
      } else if (form.elements[k]) {
        form.elements[k].value = v;
      }
    }
    updateCounters();
  }

  function updateCounters() {
    form.querySelectorAll('.counter').forEach((c) => {
      const el = form.elements[c.dataset.for];
      c.textContent = `${el.value.length}/${el.maxLength}`;
    });
  }

  form.addEventListener('input', updateCounters);
  form.addEventListener('reset', () => setTimeout(() => { clearErrors(); updateCounters(); }, 0));
  document.querySelectorAll('[data-example]').forEach((b) =>
    b.addEventListener('click', () => fill(window.EXAMPLES[b.dataset.example]))
  );
  updateCounters();

  // /?example=kulhad opens the form pre-filled (handy for demos and screenshots).
  const preset = new URLSearchParams(location.search || location.hash.split('?')[1] || '').get('example');
  if (preset && window.EXAMPLES[preset]) fill(window.EXAMPLES[preset]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    const data = readForm();
    const errs = check(data);
    if (Object.keys(errs).length) return showErrors(errs);

    submitBtn.disabled = true;
    statusEl.textContent = 'Working on it. This usually takes 10 to 25 seconds.';
    try {
      const out = await window.API.createPlan(data);
      if (out.fields) return showErrors(out.fields);
      if (!out.ok) throw new Error(out.error);
      if (window.showPlan) window.showPlan(out.plan);
    } catch (err) {
      alertBox.innerHTML = '<div class="alert err"></div>';
      alertBox.firstChild.textContent = err.message;
    } finally {
      submitBtn.disabled = false;
      statusEl.textContent = '';
    }
  });

  window.fillForm = fill;
})();

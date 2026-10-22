// Single-page shell for the Claude-hosted version: switches views on the URL hash.
import './api.js';

const $ = (id) => document.getElementById(id);
const VIEWS = ['new', 'plans', 'plan', 'admin'];
let isEditor = false;
let plansWired = false;

function show(name) {
  for (const v of VIEWS) $(`view-${v}`).hidden = v !== name;
  document.querySelector('main').classList.toggle('wide', name === 'admin');
  document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.view === (name === 'plan' ? 'plans' : name)));
  window.scrollTo(0, 0);
}

function route() {
  if (!location.hash.startsWith('#plan-')) document.title = 'Campaign Planner';
  const hash = location.hash.slice(1).split('?')[0] || 'new';
  if (hash.startsWith('plan-')) {
    show('plan');
    Views.savedPlan($('plan-view'), decodeURIComponent(hash.slice(5)));
  } else if (hash === 'plans') {
    show('plans');
    if (!plansWired) { Views.wireSearch($('q'), $('list')); plansWired = true; }
    Views.plansList($('list'), $('q').value.trim());
  } else if (hash === 'admin') {
    show('admin');
    if (isEditor) {
      $('admin-locked').hidden = true;
      $('admin-body').hidden = false;
      Admin.init();
    } else {
      $('admin-locked').hidden = false;
      $('admin-body').hidden = true;
    }
  } else {
    show('new');
  }
}

window.addEventListener('hashchange', route);
route();

// The admin link appears once the viewer is known to be an editor (resolves after first paint).
window.API.canSeeAdmin().then((yes) => {
  isEditor = yes;
  $('nav-admin').hidden = !yes;
  if (location.hash === '#admin') route();
});

// Builds claude/index.html, the page published on claude.ai, from the Node app's pages so both
// versions keep the same form and dashboard markup. Run: npm run build:claude
//
// Publish claude/index.html as the artifact page, with these files next to it:
//   styles.css, favicon.svg, examples.js, render.js, form.js, views.js, admin.js  (from public/)
//   api.js, main.js                                                     (from claude/)
//   lib/validate.js, lib/channels.js, lib/prompt.js, lib/planner.js, lib/dashboard.js,
//   lib/logic/channelPlan.js, lib/logic/copyCheck.js, lib/logic/testPlan.js, lib/logic/readiness.js
// Capabilities: sample, db, user, downloads.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (f) => readFileSync(path.join(root, f), 'utf8');
const mainOf = (html) => html.match(/<main[^>]*>([\s\S]*?)<\/main>/)[1];

const form = mainOf(read('public/index.html'));
const admin = mainOf(read('public/admin.html'))
  // The page header (title + refresh/export) stays; the rest sits in admin-body, shown to editors only.
  .replace('<div id="admin-alert"></div>', '<div id="admin-alert"></div>\n    <div id="admin-body" hidden>')
  + '\n    </div>';

const page = `<title>Campaign Planner</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="styles.css">

<header class="top">
  <div class="wrap">
    <a class="brand" href="#new">Campaign Planner</a>
    <nav class="nav">
      <a href="#new" data-view="new">New plan</a>
      <a href="#plans" data-view="plans">Saved plans</a>
      <a href="#admin" data-view="admin" id="nav-admin" hidden>Admin</a>
    </nav>
  </div>
</header>

<main class="wrap">
  <div id="view-new">
${form}
  </div>

  <div id="view-plans" hidden>
    <h1>Saved plans</h1>
    <p class="lede">Every plan is stored with its inputs, so you can open it again exactly as it was generated.</p>
    <div class="toolbar"><input id="q" type="search" placeholder="Search by product name"></div>
    <div class="block" id="list"><p class="empty">Loading…</p></div>
  </div>

  <div id="view-plan" hidden>
    <div id="plan-view"></div>
  </div>

  <div id="view-admin" hidden>
    <div id="admin-locked" class="alert info" hidden>The admin dashboard is only shown to people who can edit this page.</div>
${admin}
  </div>
</main>

<footer><div class="wrap">Channel and budget rules run in your browser; the copy is written by Claude on your own account and checked before it is shown.
  Source: <a href="https://github.com/henil-dev/campaign-planner">github.com/henil-dev/campaign-planner</a></div></footer>

<script src="render.js"></script>
<script src="examples.js"></script>
<script src="form.js"></script>
<script src="views.js"></script>
<script src="admin.js"></script>
<script type="module" src="main.js"></script>
`;

writeFileSync(path.join(root, 'claude', 'index.html'), page);
console.log('wrote claude/index.html');

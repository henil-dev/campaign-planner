// Builds docs/documentation.html from docs/documentation.md, then prints it to PDF with
// headless Edge or Chrome if one is installed.
//   npm run docs
// Links for the cover table come from docs/links.json; screenshots from docs/img/*.png
// (see scripts/screenshots.mjs).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { marked } from 'marked';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const docs = path.join(root, 'docs');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let md = readFileSync(path.join(docs, 'documentation.md'), 'utf8');

// Links
const links = existsSync(path.join(docs, 'links.json')) ? JSON.parse(readFileSync(path.join(docs, 'links.json'), 'utf8')) : {};
for (const key of ['live', 'github', 'video']) {
  const url = links[key];
  md = md.replace(`<!-- LINK:${key.toUpperCase()} -->`, url ? `<a href="${esc(url)}">${esc(url)}</a>` : '<em>add before submitting</em>');
}

// Commit table from git
let commits = '';
try {
  const log = execFileSync('git', ['log', '--reverse', '--date=format:%d %b %Y, %H:%M', '--format=%h%x09%ad%x09%s'], { cwd: root, encoding: 'utf8' }).trim();
  const rows = log.split('\n').map((l, i) => {
    const [hash, date, subject] = l.split('\t');
    return `<tr><td>${i + 1}</td><td><code>${esc(hash)}</code></td><td class="nowrap">${esc(date)}</td><td>${esc(subject)}</td></tr>`;
  });
  commits = `<table><thead><tr><th>#</th><th>Commit</th><th>Date</th><th>Message</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
} catch {
  commits = '<p><em>git log not available</em></p>';
}
md = md.replace('<!-- COMMITS -->', commits);

// Screenshots, if captured
const captions = {
  result: 'Result view for the Kulhad Co. example (top of the plan).',
  form: 'Input form with the "try an example" links.',
  admin: 'Admin dashboard.',
};
md = md.replace(/<!-- SHOT:(\w+) -->/g, (_, name) => {
  const file = path.join(docs, 'img', `${name}.png`);
  if (!existsSync(file)) return '';
  return `<figure><img src="img/${name}.png" alt="${esc(captions[name] || name)}"><figcaption>${esc(captions[name] || '')}</figcaption></figure>`;
});

// Architecture diagram
const box = (x, y, w, h, title, sub, kind) => {
  const fill = { rules: '#e2efe9', ai: '#eeefeb', store: '#f5eed8', plain: '#ffffff' }[kind];
  const stroke = { rules: '#1f6a55', ai: '#676b68', store: '#866412', plain: '#9a9c97' }[kind];
  const lines = sub.split('|');
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}" stroke="${stroke}"/>
    <text x="${x + w / 2}" y="${y + 20}" text-anchor="middle" font-weight="600" font-size="12">${title}</text>
    ${lines.map((s, i) => `<text x="${x + w / 2}" y="${y + 36 + i * 13}" text-anchor="middle" font-size="10" fill="#555">${s}</text>`).join('')}`;
};
const arrow = (x1, y1, x2, y2, dashed = false) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#333" stroke-width="1.2" marker-end="url(#ah)" ${dashed ? 'stroke-dasharray="4 3"' : ''}/>`;
const W = 150, H = 66;
const xs = [10, 185, 360, 535];
const diagram = `<figure class="diagram"><svg viewBox="0 0 700 340" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Arial, sans-serif">
  <defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#333"/></marker></defs>
  ${box(xs[0], 20, W, H, 'Browser form', 'product, audience, goal|budget, weeks, market', 'plain')}
  ${box(xs[1], 20, W, H, 'API layer', 'claude/api.js (page)|server.js (Node)', 'plain')}
  ${box(xs[2], 20, W, H, 'Channel rules', 'fit score, budget split|forecast', 'rules')}
  ${box(xs[3], 20, W, H, 'Claude', 'ideas + ad copy for the|chosen channels (JSON)', 'ai')}
  ${box(xs[3], 150, W, H, 'Copy checks', 'limits, claims, filler, avoid|one fix-up retry', 'rules')}
  ${box(xs[2], 150, W, H, 'Test sizing + score', 'sample size, weeks|readiness 0-100', 'rules')}
  ${box(xs[1], 150, W, H, 'Page database', 'plans, events|(SQLite in Node)', 'store')}
  ${box(xs[0], 150, W, H, 'Result view', 'tables and cards|no raw JSON', 'plain')}
  ${box(xs[1], 262, W, H, 'Admin dashboard', 'usage, cost, quality|review, export', 'plain')}
  ${arrow(xs[0] + W, 53, xs[1] - 2, 53)}
  ${arrow(xs[1] + W, 53, xs[2] - 2, 53)}
  ${arrow(xs[2] + W, 53, xs[3] - 2, 53)}
  ${arrow(xs[3] + W / 2 - 15, 20 + H, xs[3] + W / 2 - 15, 148)}
  ${arrow(xs[3] + W / 2 + 15, 150, xs[3] + W / 2 + 15, 22 + H, true)}
  <text x="${xs[3] + W / 2 + 20}" y="122" font-size="10" fill="#555">retry once</text>
  ${arrow(xs[3], 183, xs[2] + W + 2, 183)}
  ${arrow(xs[2], 183, xs[1] + W + 2, 183)}
  ${arrow(xs[1], 183, xs[0] + W + 2, 183)}
  ${arrow(xs[1] + W / 2, 150 + H, xs[1] + W / 2, 260)}
  <rect x="380" y="275" width="12" height="12" fill="#e2efe9" stroke="#1f6a55"/><text x="398" y="285" font-size="11">rules (deterministic)</text>
  <rect x="380" y="295" width="12" height="12" fill="#eeefeb" stroke="#676b68"/><text x="398" y="305" font-size="11">AI (Claude; Gemini in Node)</text>
  <rect x="530" y="275" width="12" height="12" fill="#f5eed8" stroke="#866412"/><text x="548" y="285" font-size="11">storage</text>
  <text x="380" y="327" font-size="10" fill="#555">If the model fails, the rules still return channels, budget and tests.</text>
</svg><figcaption>Request flow. Rules run on both sides of the AI call.</figcaption></figure>`;
md = md.replace('<!-- DIAGRAM -->', diagram);

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Campaign Planner: documentation</title>
<style>
  @page { size: A4; margin: 16mm 15mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; line-height: 1.5; color: #1b1d1c; max-width: 820px; margin: 0 auto; }
  h1 { font-size: 22pt; margin: 0 0 2px; }
  h1 + p { margin-top: 0; color: #555; }
  h2 { font-size: 14pt; margin: 22px 0 6px; padding-bottom: 3px; border-bottom: 1.5px solid #1f6a55; page-break-after: avoid; }
  h3 { font-size: 11pt; margin: 14px 0 4px; page-break-after: avoid; }
  p { margin: 5px 0 8px; }
  table { border-collapse: collapse; width: 100%; font-size: 8.8pt; margin: 6px 0 10px; }
  tr { page-break-inside: avoid; }
  th, td { border: 1px solid #c9cbc5; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #eeefeb; font-weight: 600; }
  code { font-family: Consolas, monospace; font-size: 8.6pt; background: #eeefeb; padding: 0 3px; border-radius: 2px; }
  blockquote { margin: 8px 0; padding: 6px 12px; background: #f3f7f5; border-left: 3px solid #1f6a55; }
  blockquote p { margin: 0; }
  ul, ol { padding-left: 20px; margin: 4px 0 8px; }
  li { margin-bottom: 3px; }
  figure { margin: 10px 0 14px; page-break-inside: avoid; }
  figure img { width: 100%; border: 1px solid #c9cbc5; }
  figcaption { font-size: 8.5pt; color: #666; margin-top: 3px; }
  .diagram svg { width: 100%; height: auto; }
  .nowrap { white-space: nowrap; }
  a { color: #1f6a55; }
</style></head><body>${marked.parse(md)}</body></html>`;

const htmlPath = path.join(docs, 'documentation.html');
writeFileSync(htmlPath, html);
console.log('wrote docs/documentation.html');

const browsers = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
];
const browser = browsers.find(existsSync);
if (!browser) {
  console.log('No Edge/Chrome found: open docs/documentation.html and print it to PDF.');
} else {
  const pdf = path.join(docs, 'Campaign-Planner-Documentation.pdf');
  execFileSync(browser, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, pathToFileURL(htmlPath).href], { stdio: 'ignore' });
  console.log('wrote docs/Campaign-Planner-Documentation.pdf');
}

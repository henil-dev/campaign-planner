// Captures the screenshots used in the documentation with headless Edge/Chrome, in light mode.
//   node scripts/screenshots.mjs [baseUrl] [resultPath] [adminPath] [formPath]
// Node build:    node scripts/screenshots.mjs http://localhost:3000 "/plan?id=1"
// Claude build:  node scripts/screenshots.mjs http://localhost:3104/ "#plan-<id>" "#admin" "#new?example=kulhad"
// The server must be running and, for the result view, the plan must already exist.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'docs', 'img');
mkdirSync(out, { recursive: true });

const [base = 'http://localhost:3000', resultPath = '/plan?id=1', adminPath = '/admin', formPath = '/?example=kulhad'] = process.argv.slice(2);
// Adds ?theme=light (see public/render.js): headless browsers follow the OS colour scheme.
const url = (p) => {
  const b = base.replace(/\/$/, '');
  if (p.startsWith('#')) return `${b}/?theme=light${p}`;
  return `${b}${p}${p.includes('?') ? '&' : '?'}theme=light`;
};

const browser = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium',
].find(existsSync);
if (!browser) throw new Error('No Edge or Chrome found.');

const shots = [
  { name: 'form', url: url(formPath), size: '1100,1180' },
  { name: 'result', url: url(resultPath), size: '1100,3400' },
  { name: 'admin', url: url(adminPath), size: '1240,1760' },
];

for (const s of shots) {
  execFileSync(browser, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    `--window-size=${s.size}`, '--virtual-time-budget=8000', `--screenshot=${path.join(out, s.name + '.png')}`, s.url,
  ], { stdio: 'ignore' });
  console.log('captured', s.name);
}

// Captures the screenshots used in the documentation with headless Edge/Chrome.
//   node scripts/screenshots.mjs [planId] [baseUrl]
// The server must be running. planId is the saved plan to show as the result view.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'docs', 'img');
mkdirSync(out, { recursive: true });

const [planId = '1', base = 'http://localhost:3000'] = process.argv.slice(2);
const browser = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium',
].find(existsSync);
if (!browser) throw new Error('No Edge or Chrome found.');

const shots = [
  { name: 'form', url: `${base}/?example=kulhad`, size: '1100,1180' },
  { name: 'result', url: `${base}/plan?id=${planId}`, size: '1100,2300' },
  { name: 'admin', url: `${base}/admin`, size: '1240,1500' },
];

for (const s of shots) {
  execFileSync(browser, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', `--window-size=${s.size}`,
    '--virtual-time-budget=6000', `--screenshot=${path.join(out, s.name + '.png')}`, s.url,
  ], { stdio: 'ignore' });
  console.log('captured', s.name);
}

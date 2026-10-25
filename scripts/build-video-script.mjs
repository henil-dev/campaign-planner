// Turns docs/video-script.md into a PDF with headless Edge or Chrome.
//   node scripts/build-video-script.mjs [outputPdfPath]
// Without an argument it writes docs/Video-Script.pdf.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { marked } from 'marked';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pdf = path.resolve(process.argv[2] || path.join(root, 'docs', 'Video-Script.pdf'));
const html = path.join(root, 'docs', 'video-script.html');

const body = marked.parse(readFileSync(path.join(root, 'docs', 'video-script.md'), 'utf8'));
writeFileSync(html, `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Demo video script: Campaign Planner</title>
<style>
  @page { size: A4; margin: 16mm 15mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10.5pt; line-height: 1.5; color: #1b1d1c; }
  h1 { font-size: 20pt; margin: 0 0 2px; }
  h1 + p { margin-top: 0; color: #555; }
  h2 { font-size: 13pt; margin: 20px 0 6px; padding-bottom: 3px; border-bottom: 1.5px solid #1f6a55; page-break-after: avoid; }
  p { margin: 5px 0 8px; }
  ul { padding-left: 20px; margin: 4px 0 8px; }
  li { margin-bottom: 4px; }
  table { border-collapse: collapse; width: 100%; font-size: 9.6pt; margin: 8px 0; }
  tr { page-break-inside: avoid; }
  th, td { border: 1px solid #c9cbc5; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #eeefeb; }
  td:first-child { white-space: nowrap; font-weight: 600; width: 44px; }
  td:nth-child(2) { width: 26%; color: #444; }
</style></head><body>${body}</body></html>`);

const browser = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].find(existsSync);
if (!browser) throw new Error('No Edge or Chrome found: open docs/video-script.html and print it to PDF.');
execFileSync(browser, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, pathToFileURL(html).href], { stdio: 'ignore' });
console.log('wrote', pdf);

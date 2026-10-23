// Collects everything that gets submitted into one folder next to the repo:
//   ../Build an AI-Powered Workflow System - Henil Shah/
//     Campaign-Planner-Documentation.pdf   upload this on Airtribe
//     Submission.md                        links to paste, brief checklist, demo outline
//     source-code.zip                      the repo at HEAD (git archive)
//     screenshots/                         the images used in the PDF
// Run: npm run package   (rebuilds the PDF first, so put the video link in docs/links.json before)
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FOLDER = 'Build an AI-Powered Workflow System - Henil Shah';
const out = path.join(path.dirname(root), FOLDER);

execFileSync(process.execPath, [path.join(root, 'scripts', 'build-docs.mjs')], { cwd: root, stdio: 'inherit' });

mkdirSync(out, { recursive: true });
copyFileSync(path.join(root, 'docs', 'Campaign-Planner-Documentation.pdf'), path.join(out, 'Campaign-Planner-Documentation.pdf'));

// Source: tracked files at HEAD only, so .env, node_modules and the local database never go in.
const zip = path.join(out, 'source-code.zip');
rmSync(zip, { force: true });
execFileSync('git', ['archive', '--format=zip', `--prefix=campaign-planner/`, '-o', zip, 'HEAD'], { cwd: root });

const shots = path.join(out, 'screenshots');
rmSync(shots, { recursive: true, force: true });
mkdirSync(shots, { recursive: true });
const imgDir = path.join(root, 'docs', 'img');
if (existsSync(imgDir)) for (const f of readdirSync(imgDir)) copyFileSync(path.join(imgDir, f), path.join(shots, f));

const links = JSON.parse(readFileSync(path.join(root, 'docs', 'links.json'), 'utf8'));
const commits = execFileSync('git', ['rev-list', '--count', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const video = links.video || '(add after recording)';

writeFileSync(path.join(out, 'Submission.md'), `# Build an AI-Powered Workflow System: Henil Shah

Track 3, Marketing & Growth. Product: Campaign Generator ("Campaign Planner").

## What to submit on Airtribe

| Brief asks for | What to give |
|---|---|
| Documentation (PDF) | \`Campaign-Planner-Documentation.pdf\` (in this folder) |
| Replit project link | Not used. The live app is a Claude page: ${links.live} |
| GitHub repository link | ${links.github} (${commits} commits) |
| Demo video (Loom or Drive) | ${video} |

The PDF's first page repeats the live app, GitHub and video links.

Before submitting: open the live page's **Share** menu and turn on link sharing, then open the link in a private window to check it loads. Viewers need Contributor access for their plans to be saved; with view-only access they still get the full plan, with a note that it was not saved.

## Brief checklist

| Requirement | Where it is met |
|---|---|
| Working full-stack application | Live Claude page; the same code also runs as an Express + SQLite server (\`npm start\`) |
| Frontend: structured input and output | Form with validation; result shown as tables and cards, no raw JSON |
| Backend: AI + rule-based processing | \`lib/planner.js\` runs rules, then Claude, then rules |
| Smart logic layer | \`lib/logic/\`: channel scoring, budget split, forecasts, copy checks, A/B sample sizing, readiness score. Each result section is labelled "rules" or "AI" |
| Database integration | Page database (\`plans\`, \`events\`) on the Claude page; SQLite in the Node build |
| Admin dashboard | \`#admin\` / \`/admin\`: usage, AI success rate, cost, readiness, channels, copy problems, review, delete, CSV export, event log |
| Input to processing to storage to output | \`API.createPlan\` in \`claude/api.js\` (page) and \`server.js\` (Node) |
| Minimum 6 commits, one per stage | ${commits} commits: setup, form, API + AI, logic layer, database, admin dashboard, then the Claude version and docs |
| Documentation sections | PDF sections 2 (architecture), 3 (frontend), 4 (backend + logic), 5 (database), 6 (admin), 7 (git progression) |

Not mentioned in the brief but worth knowing: the live page runs the pipeline in the browser, so the separate backend and SQLite database exist in the Node build only. The PDF explains both (section 2).

## Demo video outline (5 to 8 minutes)

1. 0:00 The problem: a chat answer suggests too many channels and tests the budget cannot feed.
2. 0:45 Fill the form (use the clay cookware example), show the validation by leaving a field empty first.
3. 1:45 The result: point at the "rules" and "AI" labels, the budget split, the "Not used" line, then the ad copy with character counters and "Passed checks".
4. 3:30 The A/B test plan: a test marked "Not enough traffic", and the readiness score deductions.
5. 4:30 Saved plans, open one, give feedback.
6. 5:15 Admin: usage, AI success rate, copy problems caught, review status, CSV export, event log.
7. 6:15 Architecture: the PDF diagram, then the repo's commit history on GitHub.
8. 7:15 What you would do next (see section 9 of the PDF).

Optional, 30 seconds: in a terminal run \`npm install\` and \`npm start\`, open http://localhost:3000/admin, and show that the Node build has a real API and SQLite database behind the same screens.
`);

console.log('Submission folder ready:', out);

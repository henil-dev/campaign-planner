# Campaign Planner

Airtribe GenAI Builder, core project. Track 3: Marketing & Growth (Campaign Generator).

- **Live app:** https://claude.ai/artifact/5GBzAsTthBhjmvgjoZrrCg (open while signed in to claude.ai)
- **Documentation:** [`docs/Campaign-Planner-Documentation.pdf`](docs/Campaign-Planner-Documentation.pdf) (source: [`docs/documentation.md`](docs/documentation.md))

**Tools:** built in Claude Code, versioned on GitHub, published as a Claude page, Claude as the model.

You give it a product, who it's for and a monthly budget. It gives back a campaign plan:
which channels to use and how much to put in each, campaign ideas, two ad versions per
channel, an A/B test plan sized to the traffic the budget can buy, and a readiness score
that lists exactly what is wrong before launch.

## Why not just ask ChatGPT?

A chat answer gets the creative part right and the numbers wrong. It will happily suggest
six channels for a ₹30,000 budget, or an A/B test that needs 40,000 visitors when the
budget buys 3,000 clicks. So the work is split:

| Step | Done by | What happens |
|---|---|---|
| Pick channels, split budget, forecast | Rules (`lib/logic/channelPlan.js`) | Scores six channels on fit, drops ones the budget can't support, splits money, estimates clicks and results |
| Write ideas and copy | Claude (`lib/prompt.js`, `claude/api.js`) | Writes only for the channels the rules picked, in a fixed JSON shape |
| Check the copy | Rules (`lib/logic/copyCheck.js`) | Length limits per channel, risky claims, filler words, the user's "avoid" note, near-identical A/B versions, generic copy. Hard failures go back to the model once |
| Size the tests | Rules (`lib/logic/testPlan.js`) | Sample size per version (95% confidence, 80% power), weeks needed, and whether it fits the campaign |
| Score | Rules (`lib/logic/readiness.js`) | Starts at 100, takes points off for each problem, lists every deduction |

If Claude isn't available (signed out, declined, usage limit), you still get the channel
plan, budget split, forecast and a default test from the rules, with a clear message about
what's missing.

## How the code is laid out

`lib/planner.js` runs the pipeline and takes the model as a plug-in. Every page talks to the
backend through one interface, `window.API`. That gives two builds from the same files:

| | Claude page (live) | Node server (local) |
|---|---|---|
| Pipeline runs | in the browser | in Express |
| Model | Claude, via the page's `sample` capability | Gemini 2.5 Flash over REST |
| Storage | the page's database (`plans`, `events`) | SQLite (`plans`, `events`) |
| Backend interface | `claude/api.js` | `public/api.js` + `server.js` |
| Admin | shown to people who can edit the page | `/admin`, Basic auth via `ADMIN_PASSWORD` |

```
lib/validate.js        input checks
lib/channels.js        channel formats, copy limits, benchmark numbers (edit numbers here)
lib/logic/             the rule layer: channelPlan, copyCheck, testPlan, readiness
lib/prompt.js          system prompt, JSON schema, prompt builder
lib/planner.js         runs the pipeline in order, model passed in
lib/dashboard.js       admin numbers from a list of plan rows (both builds)
public/                shared UI: form, result renderer, saved plans, admin
claude/                Claude page: api.js (Claude + page database), main.js (views), index.html (built)
server.js, lib/llm.js, lib/db.js, lib/stats.js   Node build only
docs/                  documentation source and PDF
```

## Publish the Claude page

```bash
npm run build:claude
```

This writes `claude/index.html` from the same form and dashboard markup the Node pages use.
Publish it from Claude Code as an artifact with these files next to it: from `public/`:
`styles.css`, `favicon.svg`, `examples.js`, `render.js`, `form.js`, `views.js`, `admin.js`;
from `claude/`: `api.js`, `main.js`; and under `lib/`: `validate.js`, `channels.js`,
`prompt.js`, `planner.js`, `dashboard.js`, `logic/channelPlan.js`, `logic/copyCheck.js`,
`logic/testPlan.js`, `logic/readiness.js`. Capabilities: `sample`, `db`, `user`, `downloads`.

To let others use it, open the page on claude.ai, click **Share**, and turn on link sharing.
Viewers need at least Contributor access for their plans to be saved.

## Run it locally (Node + Gemini)

Needs Node 20 or newer.

```bash
npm install
cp .env.example .env    # then put a Gemini key in .env
npm start
```

Open http://localhost:3000. Without a key the app still runs and returns the rule-based plan.

| Variable | Needed | Default |
|---|---|---|
| `GEMINI_API_KEY` | for the AI step | none |
| `GEMINI_MODEL` | no | `gemini-2.5-flash` (falls back to `gemini-flash-latest` if retired) |
| `ADMIN_PASSWORD` | no | admin open |
| `DB_PATH` | no | `data/campaigns.db` |
| `PORT` | no | `3000` |

Rebuild the documentation PDF with `npm run docs` (needs Edge or Chrome installed).

## Limits worth knowing

- The forecast numbers are planning benchmarks, not live auction data. They're shown as a
  ±30% range and kept in one file (`lib/channels.js`) so they're easy to update.
- The "avoid" check catches discounts and simple "no X" phrases, not every possible instruction.
- The generic-copy check looks for a price, place, name or other detail from the input. It
  can miss copy that is specific but bland.

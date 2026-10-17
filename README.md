# Campaign Planner

Airtribe GenAI Builder, core project. Track 3: Marketing & Growth (Campaign Generator).

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
| Write ideas and copy | Gemini (`lib/prompt.js`, `lib/llm.js`) | Writes only for the channels the rules picked, in a fixed JSON schema |
| Check the copy | Rules (`lib/logic/copyCheck.js`) | Length limits per channel, risky claims, filler words, the user's "avoid" note, near-identical A/B versions, generic copy. Hard failures go back to the model once |
| Size the tests | Rules (`lib/logic/testPlan.js`) | Sample size per version (95% confidence, 80% power), weeks needed, and whether it fits the campaign |
| Score | Rules (`lib/logic/readiness.js`) | Starts at 100, takes points off for each problem, lists every deduction |

If the AI call fails or there is no key, you still get the channel plan, budget split,
forecast and a default test from the rules, with a clear message about what's missing.

## Pages

- `/` new plan (form, then the result)
- `/plans` saved plans, `/plan?id=N` one saved plan (printable)
- `/admin` dashboard: usage, AI success rate, cost, readiness mix, channels picked, copy
  problems caught, plan review (new / approved / archived), delete, CSV export, event log

## API

| Method | Path | |
|---|---|---|
| POST | `/api/plan` | Validate, run the pipeline, save, return the plan |
| GET | `/api/plans?q=` | List saved plans |
| GET | `/api/plans/:id` | One saved plan |
| POST | `/api/plans/:id/feedback` | `{ "useful": true \| false }` |
| GET | `/api/admin/stats` | Dashboard numbers |
| GET | `/api/admin/plans` | Plans with filters (`q`, `level`, `status`, `review`) |
| PATCH | `/api/admin/plans/:id` | `{ "reviewStatus": "approved" }` |
| DELETE | `/api/admin/plans/:id` | Delete a plan |
| GET | `/api/admin/export.csv` | CSV of all plans |
| GET | `/api/health` | Server and AI key status |

## Run locally

Needs Node 20 or newer.

```bash
npm install
cp .env.example .env    # then put your Gemini key in .env
npm start
```

Open http://localhost:3000. Get a Gemini key at https://aistudio.google.com/apikey.

| Variable | Needed | Default |
|---|---|---|
| `GEMINI_API_KEY` | for the AI step | none |
| `GEMINI_MODEL` | no | `gemini-2.5-flash` (falls back to `gemini-flash-latest` if retired) |
| `ADMIN_PASSWORD` | no, but set it on a public deploy | admin open |
| `DB_PATH` | no | `data/campaigns.db` |
| `PORT` | no | `3000` |

## Deploy on Replit

1. Import this GitHub repo into Replit.
2. Add `GEMINI_API_KEY` and `ADMIN_PASSWORD` under **Secrets**.
3. Press **Run**. The `.replit` file installs dependencies and starts the server on port 3000.
4. For a link that stays up, use **Deploy → Reserved VM**. Autoscale deployments reset the
   SQLite file, so saved plans would not survive.

## Project layout

```
server.js              routes, rate limit, admin auth
lib/validate.js        input checks
lib/channels.js        channel formats, copy limits, benchmark numbers (edit numbers here)
lib/logic/             the rule layer: channelPlan, copyCheck, testPlan, readiness
lib/prompt.js          system prompt, JSON schema, prompt builder
lib/llm.js             Gemini REST call: timeout, one retry, model fallback
lib/planner.js         runs the pipeline in order
lib/db.js, stats.js    SQLite storage and dashboard queries
public/                plain HTML/CSS/JS, no build step
docs/                  documentation source and PDF
```

## Limits worth knowing

- The forecast numbers are planning benchmarks, not live auction data. They're shown as a
  ±30% range and kept in one file (`lib/channels.js`) so they're easy to update.
- The "avoid" check catches discounts and simple "no X" phrases, not every possible instruction.
- The generic-copy check looks for a price, place, name or other detail from the input. It
  can miss copy that is specific but bland.

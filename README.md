# Campaign Planner

Airtribe GenAI Builder, core project. Track 3: Marketing & Growth (Campaign Generator).

You give it a product, who it's for and a monthly budget. It gives back a campaign plan:
campaign ideas, ad copy for each channel, how to split the budget across channels, and an
A/B test plan that the budget can actually support.

## Why not just ask ChatGPT?

A chat answer gets the creative part right and the numbers wrong. It will happily suggest
six channels for a ₹30,000 budget, or an A/B test that needs 40,000 visitors when the
budget buys 3,000 clicks. This tool splits the work:

- **Rules decide** which channels fit, how the money is split, and whether a test is
  feasible. These are plain functions with fixed numbers, so the same input always gives
  the same answer and every number can be explained.
- **The model writes** the ideas and the copy for the channels the rules picked.
- **Rules check** the copy afterwards (length limits, risky claims, filler words) and
  give the plan a readiness score.

## Planned build stages

1. Project setup (this commit)
2. Input form
3. Backend API + Gemini call
4. Logic layer
5. Database + saved plans
6. Admin dashboard

## Run locally

```bash
npm install
npm start
```

Open http://localhost:3000

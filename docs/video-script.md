# Demo video script: Campaign Planner

Henil Shah · Airtribe GenAI Builder, Track 3 (Marketing & Growth)

**Length:** about 4 min 30 s when read at a normal pace (around 540 spoken words). Hard limit 5:00.
**Example used:** the clay cookware brand (Kulhad Co.), the first "try an example" link on the form.

## Before you press record

- Reload the live page and wait for the form to load. Zoom the browser to 100% and hide bookmarks and other tabs.
- Open these in separate tabs so you can switch fast: the live page, the PDF (page with the architecture diagram), and the GitHub commits page.
- Do one dry run of the form first. The AI step takes about 15 seconds; if it ever stalls, stop, reload and try again, or cut to the saved Kulhad plan under Saved plans.
- Read the lines below in your own words. Do not read them word for word: it sounds flat.
- Record at 1080p. Mic close, tab notifications off.

## Script

| Time | On screen | Say |
|---|---|---|
| 0:00 | Live page, empty form | "I'm Henil Shah, and this is Campaign Planner, my project for the marketing track. You enter a product, who it's for and a monthly budget, and you get back a campaign plan. I built it because a chatbot asked for a plan on a small budget will suggest five channels and A/B tests the money can't pay for. So here the rules decide the numbers, and the AI only writes the copy." |
| 0:35 | Click **Build the plan** with the form empty, then click **clay cookware brand** | "The form checks every field. If I submit it empty, it tells me what's missing under each one. I'll use the clay cookware example: handmade pots from Khurja, home cooks in four cities, sixty thousand rupees a month, goal online sales, and a note to avoid health claims and big discounts." |
| 1:00 | Click **Build the plan**; wait about 15 seconds | "I click Build. It takes about fifteen seconds, because Claude is writing the copy. The budget and channel numbers were already worked out by the rules before the AI was called." |
| 1:15 | Result: summary strip, then section 01 Channels and budget | "Here's the plan. The strip on top shows a readiness score, the channels, expected sales and return. Section one is labelled rules: Instagram and creators get the budget, fifty-three and forty-seven percent. Google Search scored sixty-two, but it's not used because sixty thousand only stretches to two channels, and the page says that. Numbers are shown as ranges, because they come from benchmark rates, not live ad data." |
| 1:50 | Scroll through positioning, ideas, ad copy (point at a counter and "Passed checks") | "From section two it's the AI: a positioning line, three ideas, and two versions of the ad for each channel. Each ad shows a character count against that channel's limit and a Passed checks tag, because the copy is checked after it's written: length, risky claims, filler words, and my avoid note. If it fails, it goes back to the model once. There's no raw JSON anywhere on the page." |
| 2:25 | Scroll to A/B test plan, then readiness score | "The A/B tests. Claude suggests three, and the rules size each one against the traffic that channel's budget buys. The first fits in a week. The other two are marked not enough traffic: they'd need roughly thirty thousand clicks per version, and this budget buys far less. A chat answer wouldn't tell you that. Those two cost twenty points, and the score lists every deduction." |
| 3:00 | Click **Saved plans**, open the Kulhad plan, click **Yes** on feedback | "Every plan is saved with its inputs, so I can open it again exactly as it was, copy an ad, and say whether it was useful." |
| 3:20 | Click **Admin** | "Admin is only shown to people who can edit the page. It shows plans and AI success rate, average readiness, how often copy was sent back, which problems the checks caught, and a table where I can approve, archive or delete a plan. There's an event log and a CSV export." |
| 3:50 | Switch to the PDF diagram, then the GitHub commits page | "How it's built: the diagram shows the form, validation, channel rules, Claude, copy checks, test sizing, storage and output. This live page runs all of that in the browser, with Claude as the model and the page's database for storage. The same code also runs as an Express server with SQLite, which is the version with a separate backend and API. On GitHub there are over fifteen commits, one per stage, from setup through to the admin dashboard." |
| 4:25 | Back to the live page (or stay on GitHub) | "Two limits, both in the PDF: the forecast rates are benchmarks, and the admin buttons are hidden in the interface but not locked in the database. Thanks for watching." |

## If you run over five minutes

Cut in this order: the empty-form check (0:35), the saved plan step (3:00), the sentence about the Express and SQLite version (3:50). Do not cut the A/B "not enough traffic" part: it is the clearest proof of the logic layer.

## What the video has to show (from the brief)

- Frontend with structured input and structured output: yes, scenes 2 to 4
- A logic layer that visibly changes the output: yes, the "rules" labels, the budget split, the test sizing
- Database storage and retrieval: yes, saved plans
- A working admin dashboard: yes
- Input to processing to storage to output: yes, the whole run
- Git commits in stages: yes, the GitHub scene

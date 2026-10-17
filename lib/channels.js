// Channels the planner knows about: the ad format the model should write, copy limits,
// and the benchmark numbers the logic layer uses.
//
// The benchmarks are rough planning numbers for small advertisers (2025-26), not promises.
// They exist so the budget split and test sizing are consistent and explainable; the UI
// shows every forecast as a range for that reason. Edit them here, nowhere else.

export const CHANNELS = {
  google_search: {
    label: 'Google Search',
    format: 'Search ad. Headline is one RSA headline (max 30 characters); body is one description line (max 90 characters).',
    limits: { headline: { max: 30, hard: true }, body: { max: 90, hard: true } },
    cpc: 28, // ₹ per click, India metro, before business-type multiplier
    cpm: 320,
    ctr: 0.045, // impression -> click
    intent: 1.6, // multiplier on the goal's base conversion rate (people searching already want the thing)
    minMonthly: 15000,
  },
  meta: {
    label: 'Instagram & Facebook',
    format: 'Feed/Reels ad. Body is the primary text above the image (aim for under 125 characters); headline sits under the image (max 40).',
    limits: { headline: { max: 40, hard: false }, body: { max: 125, hard: false } },
    cpc: 9,
    cpm: 95,
    ctr: 0.011,
    intent: 0.9,
    minMonthly: 15000,
  },
  youtube: {
    label: 'YouTube',
    format: 'Short in-stream video. Headline is the on-screen hook in the first 5 seconds (max 50 characters); body is a 15-20 second voiceover script (max 55 words).',
    limits: { headline: { max: 50, hard: false }, bodyWords: { max: 55, hard: false } },
    cpc: 14,
    cpm: 75,
    ctr: 0.006,
    intent: 0.55,
    minMonthly: 20000,
  },
  linkedin: {
    label: 'LinkedIn',
    format: 'Sponsored post. Body is the intro text (aim for under 150 characters); headline sits under the image (max 70).',
    limits: { headline: { max: 70, hard: false }, body: { max: 150, hard: false } },
    cpc: 110,
    cpm: 650,
    ctr: 0.006,
    intent: 1.0,
    minMonthly: 40000,
  },
  influencers: {
    label: 'Creators / influencers',
    format: 'Brief for a creator. Headline is the content idea; body is 3-4 talking points the creator should hit in their own words.',
    limits: { headline: { max: 80, hard: false } },
    cpc: 18, // effective, from typical micro-creator fees per 1,000 views
    cpm: 260,
    ctr: 0.012,
    intent: 0.75,
    minMonthly: 25000,
  },
  communities: {
    label: 'Reddit & Quora',
    format: 'Promoted post in a relevant community. Headline is the post title (max 120 characters); body is the post text, written like a person, not an ad.',
    limits: { headline: { max: 120, hard: false } },
    cpc: 16,
    cpm: 140,
    ctr: 0.008,
    intent: 0.8,
    minMonthly: 10000,
  },
};

export const CHANNEL_KEYS = Object.keys(CHANNELS);

// Click -> result conversion rate by goal, before the channel's intent multiplier.
export const BASE_CVR = { leads: 0.05, sales: 0.016, installs: 0.12, awareness: 0.02 };

// Some categories pay more per click (more advertisers bidding for the same people).
export const CPC_MULTIPLIER = {
  b2b_saas: 1.8, finance: 2.0, education: 1.15, health: 1.25, d2c: 1.0, consumer_app: 0.9, local: 0.85,
};

export const MARKET_MULTIPLIER = { india_metro: 1.0, india_all: 0.8, international: 5.0 };

// How well each channel fits a business type and a goal, 0-5. Hand-set from common practice.
export const FIT_BY_BUSINESS = {
  b2b_saas:     { google_search: 5, meta: 2, youtube: 2, linkedin: 5, influencers: 1, communities: 3 },
  d2c:          { google_search: 3, meta: 5, youtube: 3, linkedin: 0, influencers: 5, communities: 2 },
  consumer_app: { google_search: 2, meta: 5, youtube: 4, linkedin: 0, influencers: 4, communities: 3 },
  education:    { google_search: 4, meta: 4, youtube: 5, linkedin: 2, influencers: 3, communities: 3 },
  local:        { google_search: 5, meta: 4, youtube: 1, linkedin: 0, influencers: 2, communities: 1 },
  finance:      { google_search: 5, meta: 3, youtube: 3, linkedin: 3, influencers: 2, communities: 3 },
  health:       { google_search: 4, meta: 4, youtube: 3, linkedin: 1, influencers: 4, communities: 2 },
};

export const FIT_BY_GOAL = {
  awareness: { google_search: 1, meta: 5, youtube: 5, linkedin: 3, influencers: 5, communities: 3 },
  leads:     { google_search: 5, meta: 4, youtube: 2, linkedin: 4, influencers: 2, communities: 3 },
  sales:     { google_search: 5, meta: 5, youtube: 2, linkedin: 1, influencers: 4, communities: 2 },
  installs:  { google_search: 2, meta: 5, youtube: 4, linkedin: 0, influencers: 3, communities: 2 },
};

// Words in the audience description that point towards a channel.
export const AUDIENCE_SIGNALS = [
  { re: /\b(founders?|owners?|ceos?|cfos?|heads? of|managers?|directors?|hr|recruiters?|ca firms?|agenc(y|ies)|b2b|accounts? heads?)\b/i, channel: 'linkedin', why: 'audience is described by job role' },
  { re: /\b(students?|class \d+|jee|neet|upsc|exam|parents?|teenagers?|gen ?z)\b/i, channel: 'youtube', why: 'students and parents research on YouTube' },
  { re: /\b(instagram|reels|follow|home cooks?|moms?|mothers?|women|fashion|beauty|lifestyle)\b/i, channel: 'meta', why: 'audience is active on Instagram' },
  { re: /\b(instagram|creators?|influencers?|follow(s|ers)?|youtubers?)\b/i, channel: 'influencers', why: 'audience already follows creators' },
  { re: /\b(developers?|engineers?|gamers?|reddit|quora|enthusiasts?|hobbyists?)\b/i, channel: 'communities', why: 'audience gathers in online communities' },
  { re: /\b(search(es|ing)?|looking for|need(s)? a|near me|urgent|by hand today|chase|manually)\b/i, channel: 'google_search', why: 'people already look for a fix' },
];

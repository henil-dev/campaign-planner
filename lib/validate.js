// Server-side input checks. Returns { ok, data, fields } where fields maps a form field to a message.

export const BUSINESS_TYPES = {
  b2b_saas: 'B2B software / SaaS',
  d2c: 'D2C brand / online store',
  consumer_app: 'Consumer app',
  education: 'Education / courses',
  local: 'Local business',
  finance: 'Finance / fintech',
  health: 'Health & wellness',
};

export const GOALS = {
  awareness: 'Get known (reach)',
  leads: 'Leads / sign-ups',
  sales: 'Online sales',
  installs: 'App installs',
};

export const MARKETS = {
  india_metro: 'India, metro cities',
  india_all: 'India, nationwide',
  international: 'US / UK / Europe',
};

export const TONES = {
  plain: 'Plain and direct',
  friendly: 'Warm and friendly',
  premium: 'Premium, understated',
  playful: 'Playful',
};

const WEEKS = [2, 4, 6, 8, 12];

const str = (v, max) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(String(v).replace(/[,\s₹]/g, '')));

export function validateInput(body = {}) {
  const fields = {};
  const data = {
    productName: str(body.productName, 60),
    businessType: str(body.businessType, 30),
    description: str(body.description, 600),
    audience: str(body.audience, 400),
    goal: str(body.goal, 20),
    budget: num(body.budget),
    weeks: num(body.weeks),
    market: str(body.market, 20) || 'india_metro',
    orderValue: num(body.orderValue),
    tone: str(body.tone, 20) || 'plain',
    avoid: str(body.avoid, 200),
  };

  if (data.productName.length < 2) fields.productName = 'Add the product or brand name.';
  if (!BUSINESS_TYPES[data.businessType]) fields.businessType = 'Pick the type of business.';
  if (data.description.length < 30) fields.description = 'Describe the product in at least 30 characters.';
  if (data.audience.length < 20) fields.audience = 'Describe the audience in at least 20 characters.';
  if (!GOALS[data.goal]) fields.goal = 'Pick one main goal.';
  if (!Number.isFinite(data.budget) || data.budget < 5000) fields.budget = 'Budget must be at least ₹5,000 a month.';
  else if (data.budget > 5000000) fields.budget = 'Budgets above ₹50 lakh a month are out of range.';
  if (!WEEKS.includes(data.weeks)) fields.weeks = 'Pick a campaign length from the list.';
  if (!MARKETS[data.market]) fields.market = 'Pick a market from the list.';
  if (!TONES[data.tone]) fields.tone = 'Pick a tone from the list.';
  if (data.orderValue !== null && (!Number.isFinite(data.orderValue) || data.orderValue < 50 || data.orderValue > 10000000)) {
    fields.orderValue = 'Enter a value between 50 and 1,00,00,000, or leave it empty.';
  }

  // Text that is just repeated characters or keyboard mashing gives the model nothing to work with.
  for (const k of ['description', 'audience']) {
    if (!fields[k] && /^(.)\1{9,}$/.test(data[k].replace(/\s/g, ''))) fields[k] = 'This looks like placeholder text.';
    if (!fields[k] && data[k].split(' ').length < 4) fields[k] = 'Use a few full words so the plan has something to go on.';
  }

  if (data.budget) data.budget = Math.round(data.budget);
  if (data.orderValue) data.orderValue = Math.round(data.orderValue);

  return { ok: Object.keys(fields).length === 0, data, fields };
}

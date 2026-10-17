import { CHANNELS, CHANNEL_KEYS } from './channels.js';
import { BUSINESS_TYPES, GOALS, MARKETS, TONES } from './validate.js';

export const SYSTEM_PROMPT = `You are a performance marketer who has run paid campaigns for small Indian and international businesses.
You write campaign plans that a founder can launch next week without rewriting.

Rules for everything you write:
- Be specific to THIS product and THIS audience. Use the details the user gave: price, place, what they use today, what makes the product different. If a line would work for any product, rewrite it.
- No filler or hype words: unlock, elevate, seamless, revolutionize, game-changer, empower, leverage, cutting-edge, next-level, supercharge, transform your, look no further, in today's fast-paced world.
- No claims you cannot back up from the input: no "best", "#1", "guaranteed", "100%", medical cures, income or rank promises.
- Respect the user's "avoid" instructions exactly.
- Write ads the way people talk. Short sentences. One idea per ad.
- Write in English. Use rupees (₹) for Indian markets.
- Return only JSON matching the schema.`;

const adSchema = {
  type: 'object',
  properties: {
    channel: { type: 'string', enum: CHANNEL_KEYS },
    variants: {
      type: 'array',
      minItems: 2,
      maxItems: 2,
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'A or B' },
          angle: { type: 'string', description: 'What this variant leans on, in a few words, e.g. "price vs. agency fees"' },
          headline: { type: 'string' },
          body: { type: 'string' },
          cta: { type: 'string', description: 'Button or closing call to action, 2-4 words' },
        },
        required: ['label', 'angle', 'headline', 'body', 'cta'],
      },
    },
  },
  required: ['channel', 'variants'],
};

export function buildSchema({ chooseChannels }) {
  const properties = {
    positioning: {
      type: 'object',
      properties: {
        oneLiner: { type: 'string', description: 'The single sentence every ad should support' },
        audienceInsight: { type: 'string', description: 'The tension or habit in the audience this campaign uses' },
      },
      required: ['oneLiner', 'audienceInsight'],
    },
    ideas: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Short working title' },
          concept: { type: 'string', description: 'What the campaign is, 1-2 sentences' },
          whyItFits: { type: 'string', description: 'Why this audience would respond, tied to a detail from the input' },
          bestOn: { type: 'string', enum: CHANNEL_KEYS },
        },
        required: ['name', 'concept', 'whyItFits', 'bestOn'],
      },
    },
    ads: { type: 'array', items: adSchema },
    tests: {
      type: 'array',
      minItems: 2,
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          channel: { type: 'string', enum: CHANNEL_KEYS },
          variable: { type: 'string', enum: ['headline', 'offer', 'creative', 'audience', 'landing_page', 'cta'] },
          hypothesis: { type: 'string', description: 'If we change X, Y will improve because Z' },
          variantA: { type: 'string' },
          variantB: { type: 'string' },
          metric: { type: 'string', enum: ['ctr', 'conversion_rate', 'cost_per_result'] },
        },
        required: ['channel', 'variable', 'hypothesis', 'variantA', 'variantB', 'metric'],
      },
    },
    assumptions: {
      type: 'array',
      maxItems: 4,
      items: { type: 'string' },
      description: 'Things you assumed that the user should check before launch',
    },
  };
  const required = ['positioning', 'ideas', 'ads', 'tests', 'assumptions'];

  if (chooseChannels) {
    properties.channels = {
      type: 'array',
      minItems: 2,
      maxItems: 4,
      items: {
        type: 'object',
        properties: {
          channel: { type: 'string', enum: CHANNEL_KEYS },
          why: { type: 'string' },
        },
        required: ['channel', 'why'],
      },
    };
    required.unshift('channels');
  }
  return { type: 'object', properties, required };
}

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

// channels: null lets the model choose; otherwise an array of { key, budget } fixed by the logic layer.
export function buildUserPrompt(input, { channels = null } = {}) {
  const lines = [
    `Product: ${input.productName}`,
    `Business type: ${BUSINESS_TYPES[input.businessType]}`,
    `What it is: ${input.description}`,
    `Audience: ${input.audience}`,
    `Main goal: ${GOALS[input.goal]}`,
    `Market: ${MARKETS[input.market]}`,
    `Monthly budget: ${inr(input.budget)} for ${input.weeks} weeks`,
  ];
  if (input.orderValue) lines.push(`Average order / deal value: ${inr(input.orderValue)}`);
  lines.push(`Tone: ${TONES[input.tone]}`);
  if (input.avoid) lines.push(`Avoid: ${input.avoid}`);

  lines.push('');
  if (channels) {
    lines.push('Channels are already chosen and budgeted. Write for these only, in this order:');
    for (const c of channels) lines.push(`- ${c.key} (${CHANNELS[c.key].label}), ${inr(c.budget)}/month. Format: ${CHANNELS[c.key].format}`);
  } else {
    lines.push('Pick 2 to 4 channels that fit the audience and budget from this list, and say why:');
    for (const k of CHANNEL_KEYS) lines.push(`- ${k} (${CHANNELS[k].label}). Format: ${CHANNELS[k].format}`);
  }

  lines.push('');
  lines.push('Write: a positioning line, 3 campaign ideas, two ad variants (A and B) for each channel, 2-3 A/B tests and up to 4 assumptions to check.');
  lines.push('The two variants on a channel must differ in one clear way so they work as a test.');
  return lines.join('\n');
}

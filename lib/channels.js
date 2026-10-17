// Channels the planner knows about, and the ad format the model should write for each.
export const CHANNELS = {
  google_search: {
    label: 'Google Search',
    format: 'Search ad. Headline is one RSA headline; body is one description line.',
  },
  meta: {
    label: 'Instagram & Facebook',
    format: 'Feed/Reels ad. Body is the primary text above the image; headline sits under the image.',
  },
  youtube: {
    label: 'YouTube',
    format: 'Short in-stream video. Headline is the on-screen hook in the first 5 seconds; body is a 15-20 second voiceover script.',
  },
  linkedin: {
    label: 'LinkedIn',
    format: 'Sponsored post. Body is the intro text; headline sits under the image.',
  },
  influencers: {
    label: 'Creators / influencers',
    format: 'Brief for a creator. Headline is the content idea; body is 3-4 talking points the creator should hit in their own words.',
  },
  communities: {
    label: 'Reddit & Quora',
    format: 'Promoted post in a relevant community. Headline is the post title; body is the post text, written like a person, not an ad.',
  },
};

export const CHANNEL_KEYS = Object.keys(CHANNELS);

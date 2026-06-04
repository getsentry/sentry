export const MIN_REPLAY_CLICK_SDK = {
  minVersion: '7.44.0',
  releaseNotes: 'https://github.com/getsentry/sentry-javascript/releases/tag/7.44.0',
};

// Knowns bugs in v7.50 to v7.53.0 inclusive
export const MIN_REPLAY_NETWORK_BODIES_SDK_KNOWN_BUG = {
  minVersion: '7.50.0',
  releaseNotes: 'https://github.com/getsentry/sentry-javascript/releases/tag/7.50.0',
};

// This version fixes the known bugs when capturing network bodies
export const MIN_REPLAY_NETWORK_BODIES_SDK = {
  minVersion: '7.53.1',
  releaseNotes: 'https://github.com/getsentry/sentry-javascript/releases/tag/7.53.1',
};

export const MIN_DEAD_RAGE_CLICK_SDK = {
  minVersion: '7.60.1',
  changelog:
    'https://changelog.getsentry.com/announcements/user-frustration-signals-rage-and-dead-clicks-in-session-replay',
};

export const MIN_CANVAS_SUPPORTED_SDK = {
  minVersion: '7.98.0',
  docs: 'https://docs.sentry.io/platforms/javascript/session-replay/troubleshooting/#my-canvas-elements-arent-getting-captured',
};

export const MIN_JETPACK_COMPOSE_VIEW_HIERARCHY_PII_FIX = {
  minVersion: '8.14.0',
  releaseNotes: 'https://github.com/getsentry/sentry-java/releases/tag/8.14.0',
};

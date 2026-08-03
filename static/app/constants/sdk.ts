export const SENTRY_RELEASE_VERSION = process.env.SENTRY_RELEASE_VERSION;

export const IGNORED_BREADCRUMB_FETCH_HOSTS = [
  'amplitude.com',
  'pendo.io',
  'reload.getsentry.net',
];

export const SPA_DSN = process.env.SPA_DSN;

// Ignore analytics in spans — used by the `ignoreSpans` SDK option
export const IGNORED_SPAN_NAMES = ['amplitude.com', 'pendo.io', 'reload.getsentry.net'];
// We don't care about recording breadcrumbs for these hosts. These typically
// pollute our breadcrumbs since they may occur a LOT.
//
// XXX(epurkhiser): Note some of these hosts may only apply to sentry.io.
export const SPA_MODE_ALLOW_URLS = [
  'localhost',
  'dev.getsentry.net',
  'sentry.dev',
  'webpack-internal://',
];

export const SPA_MODE_TRACE_PROPAGATION_TARGETS = [
  'localhost',
  'dev.getsentry.net',
  'sentry.dev',
];

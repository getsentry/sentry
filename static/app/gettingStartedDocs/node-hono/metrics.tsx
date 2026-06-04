import {getNodeMetricsOnboarding} from 'sentry/gettingStartedDocs/node/metrics';

export const metrics = getNodeMetricsOnboarding({
  docsPlatform: 'hono',
  packageName: '@sentry/hono',
  importPath: '@sentry/hono/<your-runtime>',
});

import {getNodeLogsOnboarding} from 'sentry/gettingStartedDocs/node/utils';

export const logs = getNodeLogsOnboarding({
  docsPlatform: 'hono',
  packageName: '@sentry/hono',
  importPath: '@sentry/hono/<your-runtime>',
});

import {getNodeLogsOnboarding} from 'sentry/gettingStartedDocs/node/utils';

import type {PlatformOptions} from './utils';
import {CloudflareSetupType} from './utils';

const getPagesConfigureSnippet = (dsn: string, packageName: string) =>
  `import * as Sentry from "${packageName}";

export const onRequest = [
  // Make sure Sentry is the first middleware
  Sentry.sentryPagesPlugin((context) => ({
    dsn: "${dsn}",
    integrations: [
      // send console.log, console.warn, and console.error calls as logs to Sentry
      Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
    ],
  })),
  // Add more middlewares here
];`;

const getWorkersConfigureSnippet = (dsn: string, packageName: string) =>
  `import * as Sentry from "${packageName}";

export default Sentry.withSentry(
  (env: Env) => ({
    dsn: "${dsn}",
    integrations: [
      // send console.log, console.warn, and console.error calls as logs to Sentry
      Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
    ],
  }),
  {
    async fetch(request, env, ctx) {
      return new Response('Hello World!');
    },
  } satisfies ExportedHandler<Env>,
);`;

export const logs = getNodeLogsOnboarding<PlatformOptions>({
  docsPlatform: 'cloudflare',
  packageName: '@sentry/cloudflare',
  generateConfigureSnippet: (params, packageName) => ({
    type: 'code',
    language: 'javascript',
    code:
      params.platformOptions.setupType === CloudflareSetupType.PAGES
        ? getPagesConfigureSnippet(params.dsn.public, packageName)
        : getWorkersConfigureSnippet(params.dsn.public, packageName),
  }),
});

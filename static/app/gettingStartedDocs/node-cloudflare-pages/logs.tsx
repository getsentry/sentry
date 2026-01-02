import {getNodeLogsOnboarding} from 'sentry/gettingStartedDocs/node/utils';

export const logs = getNodeLogsOnboarding({
  docsPlatform: 'cloudflare',
  packageName: '@sentry/cloudflare',
  generateConfigureSnippet: (params, packageName) => ({
    type: 'code',
    language: 'javascript',
    code: `import * as Sentry from "${packageName}";

export const onRequest = [
  // Make sure Sentry is the first middleware
  Sentry.sentryPagesPlugin((context) => ({
    dsn: "${params.dsn.public}",
    integrations: [
      // send console.log, console.warn, and console.error calls as logs to Sentry
      Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
    ],
    // Enable logs to be sent to Sentry
    enableLogs: true,
  })),
  // Add more middlewares here
];`,
  }),
});

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

const getViteConfigureSnippet = (dsn: string, packageName: string) =>
  `import * as Sentry from "${packageName}";

export default Sentry.defineCloudflareOptions((env) => ({
  dsn: "${dsn}",
  integrations: [
    // send console.log, console.warn, and console.error calls as logs to Sentry
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
  ],
}));`;

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

const getConfigureTabs = (dsn: string, packageName: string) => ({
  [CloudflareSetupType.VITE]: {
    label: 'Vite Plugin',
    language: 'typescript',
    filename: 'src/instrument.server.ts',
    code: getViteConfigureSnippet(dsn, packageName),
  },
  [CloudflareSetupType.MANUAL]: {
    label: 'Manual',
    language: 'typescript',
    filename: 'src/index.ts',
    code: getWorkersConfigureSnippet(dsn, packageName),
  },
  [CloudflareSetupType.PAGES]: {
    label: 'Pages',
    language: 'javascript',
    filename: 'functions/_middleware.js',
    code: getPagesConfigureSnippet(dsn, packageName),
  },
});

export const logs = getNodeLogsOnboarding<PlatformOptions>({
  docsPlatform: 'cloudflare',
  packageName: '@sentry/cloudflare',
  generateConfigureSnippet: (params, packageName) => {
    const tabs = getConfigureTabs(params.dsn.public, packageName);
    const setupType = Object.values(CloudflareSetupType).find(
      type => type === params.platformOptions?.setupType
    );

    // The Logs page passes no setup type, so it shows every setup as a tab.
    if (!setupType) {
      return {type: 'code', tabs: Object.values(tabs)};
    }

    const {label: _label, ...snippet} = tabs[setupType];
    return {type: 'code', ...snippet};
  },
});

import {ExternalLink} from 'sentry/components/core/link';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {
  getCrashReportJavaScriptInstallSteps,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {t, tct} from 'sentry/locale';
import {
  getInstallCodeBlock,
  getNodeAgentMonitoringOnboarding,
  getNodeLogsOnboarding,
  getNodeMcpOnboarding,
} from 'sentry/utils/gettingStartedDocs/node';

type Params = DocsParams;

const getSdkConfigureSnippetToml = () => `
compatibility_flags = ["nodejs_compat"]
# compatibility_flags = ["nodejs_als"]
`;

const getSdkConfigureSnippetJson = () => `
{
  "compatibility_flags": [
    "nodejs_compat"
  ],
  "compatibility_date": "2024-09-23"
}`;

const getSdkSetupSnippet = (params: Params) => `
import * as Sentry from "@sentry/cloudflare";

export default Sentry.withSentry(
  env => ({
    dsn: "${params.dsn.public}",${
      params.isPerformanceSelected
        ? `
    // Set tracesSampleRate to 1.0 to capture 100% of spans for tracing.
    // Learn more at
    // https://docs.sentry.io/platforms/javascript/configuration/options/#traces-sample-rate
    tracesSampleRate: 1.0,`
        : ''
    }${
      params.isLogsSelected
        ? `

    // Send structured logs to Sentry
    enableLogs: true,`
        : ''
    }

    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: true,
  }),
  {
    async fetch(request, env, ctx) {
      return new Response('Hello World!');
    },
  } satisfies ExportedHandler<Env>,
);`;

const getVerifySnippet = (params: Params) => `${
  params.isLogsSelected
    ? `
// Send a log before throwing the error
Sentry.logger.info('User triggered test error', {
  action: 'test_error_worker',
});`
    : ''
}
setTimeout(() => {
  throw new Error();
});`;

const onboarding: OnboardingConfig = {
  introduction: () =>
    t(
      "In this quick guide you'll set up and configure the Sentry Cloudflare SDK for the use in your Cloudflare Workers application."
    ),
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: t('Add the Sentry Cloudflare SDK as a dependency:'),
        },
        getInstallCodeBlock(params, {basePackage: '@sentry/cloudflare'}),
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: t(
            "Configuration should happen as early as possible in your application's lifecycle."
          ),
        },
        {
          type: 'text',
          text: tct(
            "To use the SDK, you'll need to set either the [code:nodejs_compat] or [code:nodejs_als] compatibility flags in your [code:wrangler.json]/[code:wrangler.toml]. This is because the SDK needs access to the [code:AsyncLocalStorage] API to work correctly.",
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JSON',
              language: 'json',
              filename: 'wrangler.json',
              code: getSdkConfigureSnippetJson(),
            },
            {
              label: 'Toml',
              language: 'toml',
              filename: 'wrangler.toml',
              code: getSdkConfigureSnippetToml(),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'In order to initialize the SDK, wrap your handler with the [code:withSentry] function. Note that you can turn off almost all side effects using the respective options.',
            {
              code: <code />,
              guideLink: (
                <ExternalLink href="https://developers.cloudflare.com/pages/functions/middleware/" />
              ),
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'TypeScript',
              language: 'typescript',
              code: getSdkSetupSnippet(params),
            },
          ],
        },
      ],
    },
    getUploadSourceMapsStep({
      guideLink:
        'https://docs.sentry.io/platforms/javascript/guides/cloudflare/sourcemaps/',
      ...params,
    }),
  ],
  verify: (params: Params) => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: getVerifySnippet(params),
        },
      ],
    },
  ],
  nextSteps: (params: Params) => {
    const steps = [
      {
        id: 'cloudflare-features',
        name: t('Cloudflare Features'),
        description: t(
          'Learn about our first class integration with the Cloudflare Workers platform.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/cloudflare/features/',
      },
    ];

    if (params.isLogsSelected) {
      steps.push({
        id: 'logs',
        name: t('Logging Integrations'),
        description: t(
          'Add logging integrations to automatically capture logs from your application.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/cloudflare/logs/#integrations',
      });
    }

    return steps;
  },
};

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportJavaScriptInstallSteps(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getCrashReportModalConfigDescription({
            link: 'https://docs.sentry.io/platforms/javascript/guides/cloudflare/user-feedback/configuration/#crash-report-modal',
          }),
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  crashReportOnboarding,
  logsOnboarding: getNodeLogsOnboarding({
    docsPlatform: 'cloudflare',
    sdkPackage: '@sentry/cloudflare',
    generateConfigureSnippet: (params, sdkPackage) => ({
      type: 'code',
      language: 'javascript',
      code: `import * as Sentry from "${sdkPackage}";

export default Sentry.withSentry(
  env => ({
    dsn: "${params.dsn.public}",
    integrations: [
      // send console.log, console.warn, and console.error calls as logs to Sentry
      Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
    ],
    // Enable logs to be sent to Sentry
    enableLogs: true,
  }),
  {
    async fetch(request, env, ctx) {
      return new Response('Hello World!');
    },
  } satisfies ExportedHandler<Env>,
);
      `,
    }),
  }),
  agentMonitoringOnboarding: getNodeAgentMonitoringOnboarding({
    basePackage: 'cloudflare',
  }),
  mcpOnboarding: getNodeMcpOnboarding({
    basePackage: 'cloudflare',
  }),
};

export default docs;

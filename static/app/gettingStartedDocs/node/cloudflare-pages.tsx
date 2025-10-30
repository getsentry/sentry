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
compatibility_date = "2024-09-23"
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

export const onRequest = [
  // Make sure Sentry is the first middleware
  Sentry.sentryPagesPlugin((context) => ({
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
  })),
  // Add more middlewares here
];`;

const getVerifySnippet = (params: Params) => `
export function onRequest(context) {${
  params.isLogsSelected
    ? `
  // Send a log before throwing the error
  Sentry.logger.info('User triggered test error', {
    action: 'test_error_function',
  });`
    : ''
}
  throw new Error();
}`;

const onboarding: OnboardingConfig = {
  introduction: () =>
    tct(
      "In this quick guide, you'll set up and configure the Sentry Cloudflare SDK for use in your Cloudflare Pages application. This will enable Sentry for the backend part of your application: the functions. If you'd like to monitor the frontend as well, refer to the instrumentation guide for [platformLink:the framework of your choice].",
      {
        platformLink: <ExternalLink href="https://docs.sentry.io/platforms/" />,
      }
    ),
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: t('Add the Sentry Cloudflare SDK as a dependency:'),
        },
        getInstallCodeBlock(params, {packageName: '@sentry/cloudflare'}),
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
            "To use the SDK, you'll need to set either the [code:nodejs_compat] or [code:nodejs_als] compatibility flags in your [code:wrangler.toml]. This is because the SDK needs access to the [code:AsyncLocalStorage] API to work correctly.",
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
            'Add the [code:sentryPagesPlugin] as [guideLink:middleware to your Cloudflare Pages application]. We recommend adding a [code:functions/_middleware.js] for the middleware setup so that Sentry is initialized for your entire app.',
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
              label: 'JavaScript',
              language: 'javascript',
              filename: 'functions/_middleware.js',
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
          text: tct(
            "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected. To trigger it, you need to access the [code:/customerror] path on your deployment.",
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          filename: 'functions/customerror.js',
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
          'Learn about our first class integration with the Cloudflare Pages platform.'
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
  }),
  agentMonitoringOnboarding: getNodeAgentMonitoringOnboarding({
    packageName: '@sentry/cloudflare',
  }),
  mcpOnboarding: getNodeMcpOnboarding({
    packageName: '@sentry/cloudflare',
  }),
};

export default docs;

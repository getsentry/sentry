import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {
  getCrashReportJavaScriptInstallStep,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {getJSServerMetricsOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import replayOnboardingJsLoader from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {t, tct} from 'sentry/locale';
import {
  getImportInstrumentSnippet,
  getInstallConfig,
  getSdkInitSnippet,
} from 'sentry/utils/gettingStartedDocs/node';

type Params = DocsParams;

const getExampleServerSnippet = () => `
${getImportInstrumentSnippet()}
const { createServer } = require("node:http");

const server = createServer(async (req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Hello World');
});

server.listen(3000, "127.0.0.1", () => {
    console.log(\`Server running at http://127.0.0.1:3000/\`);
  });`;

const getErrorsVerifySnippet = () => `
// Capture an exception
try {
  foo();
} catch (e) {
  Sentry.captureException(e);
}`;

const getPerformanceVerifySnippet = () => `
const Sentry = require("@sentry/node");

// Start a span
Sentry.startSpan({
  op: "test",
  name: "My First Test Span",
}, async () => {
  ${getErrorsVerifySnippet()}
});`;

const hasContinuousProfiling = (params: DocsParams) =>
  params.isProfilingSelected &&
  params.profilingOptions?.defaultProfilingMode === 'continuous';

const getContinuousProfilingVerifySnippet = () => `
    async function slow_function() {
        Sentry.profiler.startProfiler();
        await new Promise(resolve => setTimeout(resolve, 5000));
        Sentry.profiler.stopProfiler();
    }
    // Start a span
    await Sentry.startSpan({
    name: "My First Test Span",
    }, async () => {
        await slow_function();
        ${getErrorsVerifySnippet()}
    });`;

const getVerifySnippet = (params: DocsParams) => {
  if (hasContinuousProfiling(params)) {
    return getContinuousProfilingVerifySnippet();
  }
  if (params.isPerformanceSelected) {
    return getPerformanceVerifySnippet();
  }
  return getErrorsVerifySnippet();
};

const onboarding: OnboardingConfig = {
  introduction: () =>
    tct('In this quick guide you’ll use [strong:npm] or [strong:yarn] to set up:', {
      strong: <strong />,
    }),
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      description: t('Add the Sentry Node SDK as a dependency:'),
      configurations: getInstallConfig(params),
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: t(
        "Initialize Sentry as early as possible in your application's lifecycle."
      ),
      configurations: [
        {
          description: tct(
            'To initialize the SDK before everything else, create an external file called [code:instrument.js/mjs].',
            {code: <code />}
          ),
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              filename: 'instrument.(js|mjs)',
              code: getSdkInitSnippet(params, 'node'),
            },
          ],
        },
        {
          description: tct(
            "Make sure to import [code:instrument.js/mjs] at the top of your file. Set up the error handler after all controllers and before any other error middleware. This setup is typically done in your application's entry point file, which is usually [code:index.(js|ts)]. If you're running your application in ESM mode, or looking for alternative ways to set up Sentry, read about [docs:installation methods in our docs].",
            {
              code: <code />,
              docs: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/node/install/" />
              ),
            }
          ),
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              filename: 'index.(js|mjs)',
              code: getExampleServerSnippet(),
            },
          ],
        },
      ],
    },
    getUploadSourceMapsStep({
      guideLink: 'https://docs.sentry.io/platforms/javascript/guides/node/sourcemaps/',
      ...params,
    }),
  ],
  verify: (params: DocsParams) => [
    {
      type: StepType.VERIFY,
      description: t('Use this snippet to verify the configured functionality.'),
      configurations: [
        {
          language: 'javascript',
          code: getVerifySnippet(params),
        },
      ],
    },
  ],
};

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportJavaScriptInstallStep(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getCrashReportModalConfigDescription({
        link: 'https://docs.sentry.io/platforms/javascript/guides/node/user-feedback/configuration/#crash-report-modal',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const performanceOnboarding: OnboardingConfig = {
  introduction: () =>
    t(
      "Adding Performance to your Node project is simple. Make sure you've got these basics down."
    ),
  install: params => [
    {
      type: StepType.INSTALL,
      description: tct('Install our Node.js SDK using [code:npm] or [code:yarn]', {
        code: <code />,
      }),
      configurations: getInstallConfig(params),
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'Sentry should be initialized as early in your app as possible. It is essential that you call [code:Sentry.init] before you require any other modules in your application—otherwise, auto-instrumentation of these modules will [strong:not] work.',
        {code: <code />, strong: <strong />}
      ),
      configurations: [
        {
          description: tct(
            'To initialize the SDK before everything else, create an external file called [code:instrument.js/mjs] and make sure to import it in your apps entrypoint before anything else.',
            {code: <code />}
          ),
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              filename: 'instrument.(js|mjs)',
              language: 'javascript',
              code: `
const Sentry = require("@sentry/node");

// Ensure to call this before requiring any other modules!
Sentry.init({
  dsn: "${params.dsn.public}",
  integrations: [Sentry.browserTracingIntegration()],

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
});
`,
            },
          ],
          additionalInfo: tct(
            'We recommend adjusting the value of [code:tracesSampleRate] in production. Learn more about tracing [linkTracingOptions:options], how to use the [linkTracesSampler:traces_sampler] function, or how to [linkSampleTransactions:sample transactions].',
            {
              code: <code />,
              linkTracingOptions: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/node/configuration/options/#tracing-options" />
              ),
              linkTracesSampler: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/node/configuration/sampling/" />
              ),
              linkSampleTransactions: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/node/configuration/sampling/" />
              ),
            }
          ),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: tct(
        'Verify that performance monitoring is working correctly with our [link:automatic instrumentation] by simply using your Node application.',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/node/tracing/instrumentation/automatic-instrumentation/" />
          ),
        }
      ),
      additionalInfo: tct(
        'You have the option to manually construct a transaction using [link:custom instrumentation].',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/node/tracing/instrumentation/custom-instrumentation/" />
          ),
        }
      ),
    },
  ],
  nextSteps: () => [],
};

const profilingOnboarding: OnboardingConfig = {
  ...onboarding,
  introduction: () => null,
};

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  customMetricsOnboarding: getJSServerMetricsOnboarding(),
  performanceOnboarding,
  crashReportOnboarding,
  profilingOnboarding,
};

export default docs;

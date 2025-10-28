import {ExternalLink} from 'sentry/components/core/link';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
  getCrashReportPHPInstallSteps,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getConfigureSnippet = (params: Params) => `\\Sentry\\init([
  'dsn' => '${params.dsn.public}',${
    params.isPerformanceSelected
      ? `
  // Specify a fixed sample rate
  'traces_sample_rate' => 1.0,`
      : ''
  }${
    params.isProfilingSelected
      ? `
  // Set a sampling rate for profiling - this is relative to traces_sample_rate
  'profiles_sample_rate' => 1.0,`
      : ''
  }${
    params.isLogsSelected
      ? `
  // Enable logs to be sent to Sentry
  'enable_logs' => true,`
      : ''
  }
]);`;

const getVerifySnippet = () => `
try {
  $this->functionFailsForSure();
} catch (\\Throwable $exception) {
  \\Sentry\\captureException($exception);
}`;

const onboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'To install the PHP SDK, you need to be using Composer in your project. For more details about Composer, see the [composerDocumentationLink:Composer documentation].',
            {
              composerDocumentationLink: (
                <ExternalLink href="https://getcomposer.org/doc/" />
              ),
            }
          ),
        },
        {
          type: 'code',
          language: 'bash',
          code: 'composer require sentry/sentry',
        },
        {
          type: 'conditional',
          condition: params.isProfilingSelected,
          content: [
            {
              type: 'text',
              text: t('Install the Excimer extension via PECL:'),
            },
            {
              type: 'code',
              language: 'bash',
              code: 'pecl install excimer',
            },
            {
              type: 'text',
              text: tct(
                "The Excimer PHP extension supports PHP 7.2 and up. Excimer requires Linux or macOS and doesn't support Windows. For additional ways to install Excimer, see [sentryPhpDocumentationLink: Sentry documentation].",
                {
                  sentryPhpDocumentationLink: (
                    <ExternalLink href="https://docs.sentry.io/platforms/php/profiling/#installation" />
                  ),
                }
              ),
            },
          ],
        },
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
            'To capture all errors, even the one during the startup of your application, you should initialize the Sentry PHP SDK as soon as possible.'
          ),
        },
        {
          type: 'code',
          language: 'php',
          code: getConfigureSnippet(params),
        },
        {
          type: 'conditional',
          condition: params.isPerformanceSelected,
          content: [
            {
              type: 'text',
              text: tct(
                'To instrument certain regions of your code, you can [instrumentationLink:create transactions to capture them].',
                {
                  instrumentationLink: (
                    <ExternalLink href="https://docs.sentry.io/platforms/php/tracing/instrumentation/custom-instrumentation/" />
                  ),
                }
              ),
            },
          ],
        },
        {
          type: 'alert',
          alertType: 'warning',
          showIcon: false,
          text: tct(
            'In order to receive stack trace arguments in your errors, make sure to set [code:zend.exception_ignore_args: Off] in your php.ini',
            {
              code: <code />,
            }
          ),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'In PHP you can either capture a caught exception or capture the last error with captureLastError.'
          ),
        },
        {
          type: 'code',
          language: 'php',
          code: getVerifySnippet(),
        },
      ],
    },
  ],
  nextSteps: () => [],
};

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportPHPInstallSteps(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getCrashReportModalConfigDescription({
            link: 'https://docs.sentry.io/platforms/php/user-feedback/configuration/#crash-report-modal',
          }),
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const performanceOnboarding: OnboardingConfig = {
  introduction: () =>
    t(
      "Adding Performance to your PHP project is simple. Make sure you've got these basics down."
    ),
  install: onboarding.install,
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: t(
            'To capture all errors and transactions, even the one during the startup of your application, you should initialize the Sentry PHP SDK as soon as possible.'
          ),
        },
        {
          type: 'text',
          text: tct(
            'To initialize the SDK before everything else, create an external file called [code:instrument.js/mjs] and make sure to import it in your apps entrypoint before anything else.',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'php',
          code: `
\\Sentry\\init([
  'dsn' => '${params.dsn.public}',

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  'traces_sample_rate' => 1.0,
]);
`,
        },
        {
          type: 'text',
          text: tct(
            'We recommend adjusting the value of [code:tracesSampleRate] in production. Learn more about tracing [linkTracingOptions:options], how to use the [linkTracesSampler:traces_sampler] function, or how to do [linkSampleTransactions:sampling].',
            {
              code: <code />,
              linkTracingOptions: (
                <ExternalLink href="https://docs.sentry.io/platforms/php/configuration/options/" />
              ),
              linkTracesSampler: (
                <ExternalLink href="https://docs.sentry.io/platforms/php/configuration/sampling/" />
              ),
              linkSampleTransactions: (
                <ExternalLink href="https://docs.sentry.io/platforms/php/configuration/sampling/" />
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
      content: [
        {
          type: 'text',
          text: tct(
            'Verify that performance monitoring is working correctly with our [link:automatic instrumentation] by simply using your Node application.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/php/tracing/instrumentation/automatic-instrumentation/" />
              ),
            }
          ),
        },
      ],
    },
  ],
  nextSteps: () => [],
};

const getProfilingConfigureSnippet = (params: DocsParams) => `\\Sentry\\init([
  'dsn' => '${params.dsn.public}',
  // Specify a fixed sample rate
  'traces_sample_rate' => 1.0,
  // Set a sampling rate for profiling - this is relative to traces_sample_rate
  'profiles_sample_rate' => 1.0
]);`;

const profilingOnboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'To install the PHP SDK, you need to be using Composer in your project. For more details about Composer, see the [composerDocumentationLink:Composer documentation].',
            {
              composerDocumentationLink: (
                <ExternalLink href="https://getcomposer.org/doc/" />
              ),
            }
          ),
        },
        {
          type: 'code',
          language: 'bash',
          code: 'composer require sentry/sentry',
        },
        {
          type: 'text',
          text: t('Install the Excimer extension via PECL:'),
        },
        {
          type: 'code',
          language: 'bash',
          code: 'pecl install excimer',
        },
        {
          type: 'text',
          text: tct(
            "The Excimer PHP extension supports PHP 7.2 and up. Excimer requires Linux or macOS and doesn't support Windows. For additional ways to install Excimer, see [sentryPhpDocumentationLink:Sentry documentation].",
            {
              sentryPhpDocumentationLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/php/profiling/#installation" />
              ),
            }
          ),
        },
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
            'To capture profiling data, you should initialize the Sentry PHP SDK as soon as possible.'
          ),
        },
        {
          type: 'code',
          language: 'php',
          code: getProfilingConfigureSnippet(params),
        },
        {
          type: 'text',
          text: tct(
            'To instrument certain regions of your code, you can [instrumentationLink:create transactions to capture them].',
            {
              instrumentationLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/php/tracing/instrumentation/custom-instrumentation/" />
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
      content: [
        {
          type: 'text',
          text: t(
            'Verify that profiling is working correctly by simply using your application.'
          ),
        },
      ],
    },
  ],
  nextSteps: () => [],
};

const logsOnboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'To start using logs, install the latest version of the Sentry PHP SDK. Logs are supported in version [code:4.12.0] and above of the SDK.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'bash',
          code: 'composer require sentry/sentry',
        },
        {
          type: 'text',
          text: tct(
            'If you are on an older version of the SDK, follow our [link:migration guide] to upgrade.',
            {
              link: (
                <ExternalLink href="https://github.com/getsentry/sentry-php/blob/master/UPGRADE-4.0.md" />
              ),
            }
          ),
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'To enable logging, you need to initialize the SDK with the [code:enable_logs] option set to [code:true].',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'php',
          code: `\\Sentry\\init([
  'dsn' => '${params.dsn.public}',
  'enable_logs' => true,
]);

// Somewhere at the end of your execution, you should flush
// the logger to send pending logs to Sentry.
\\Sentry\\logger()->flush();`,
        },
        {
          type: 'text',
          text: tct(
            'For more detailed configuration options, see the [link:logs documentation].',
            {
              link: <ExternalLink href="https://docs.sentry.io/platforms/php/logs/" />,
            }
          ),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Verify that logging is working correctly by sending logs via the Sentry logger.'
          ),
        },
        {
          type: 'code',
          language: 'php',
          code: `\\Sentry\\logger()->info('A test log message');

// Somewhere at the end of your execution, you should flush
// the logger to send pending logs to Sentry.
\\Sentry\\logger()->flush();`,
        },
      ],
    },
  ],
};

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  performanceOnboarding,
  profilingOnboarding,
  crashReportOnboarding,
  feedbackOnboardingJsLoader,
  logsOnboarding,
};

export default docs;

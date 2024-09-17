import Alert from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
  getCrashReportPHPInstallStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import exampleSnippets from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsExampleSnippets';
import {metricTagsExplanation} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import replayOnboardingJsLoader from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
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
  }
]);`;

const getMetricsConfigureSnippet = () => `
use function \\Sentry\\init;

\\Sentry\\init([
    'attach_metric_code_locations' => true,
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
      description: tct(
        'To install the PHP SDK, you need to be using Composer in your project. For more details about Composer, see the [composerDocumentationLink:Composer documentation].',
        {
          composerDocumentationLink: <ExternalLink href="https://getcomposer.org/doc/" />,
        }
      ),
      configurations: [
        {
          language: 'bash',
          code: 'composer require sentry/sentry',
        },
        ...(params.isProfilingSelected
          ? [
              {
                description: t('Install the Excimer extension via PECL:'),
                language: 'bash',
                code: 'pecl install excimer',
              },
              {
                description: tct(
                  "The Excimer PHP extension supports PHP 7.2 and up. Excimer requires Linux or macOS and doesn't support Windows. For additional ways to install Excimer, see [sentryPhpDocumentationLink: Sentry documentation].",
                  {
                    sentryPhpDocumentationLink: (
                      <ExternalLink href="https://docs.sentry.io/platforms/php/profiling/#installation" />
                    ),
                  }
                ),
              },
            ]
          : []),
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: t(
        'To capture all errors, even the one during the startup of your application, you should initialize the Sentry PHP SDK as soon as possible.'
      ),
      configurations: [
        {
          language: 'php',
          code: getConfigureSnippet(params),
          additionalInfo: params.isPerformanceSelected && (
            <p>
              {tct(
                'To instrument certain regions of your code, you can [instrumentationLink:create transactions to capture them].',
                {
                  instrumentationLink: (
                    <ExternalLink href="https://docs.sentry.io/platforms/php/tracing/instrumentation/custom-instrumentation/" />
                  ),
                }
              )}
            </p>
          ),
        },
        {
          description: (
            <Alert type="warning">
              {tct(
                'In order to receive stack trace arguments in your errors, make sure to set [code:zend.exception_ignore_args: Off] in your php.ini',
                {
                  code: <code />,
                }
              )}
            </Alert>
          ),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t(
        'In PHP you can either capture a caught exception or capture the last error with captureLastError.'
      ),
      configurations: [
        {
          language: 'php',
          code: getVerifySnippet(),
        },
      ],
    },
  ],
  nextSteps: () => [],
};

const customMetricsOnboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'You need a minimum version [codeVersion:4.3.0] of the Sentry PHP SDK installed.',
        {
          codeVersion: <code />,
        }
      ),
      configurations: [
        {
          language: 'bash',
          code: 'composer install sentry/sentry',
        },
      ],
    },
  ],
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: t(
        'Once the SDK is installed or updated, you can enable code locations being emitted with your metrics:'
      ),
      configurations: [
        {
          code: [
            {
              label: 'PHP',
              value: 'php',
              language: 'php',
              code: getMetricsConfigureSnippet(),
            },
          ],
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: tct(
        "Then you'll be able to add metrics as [codeCounters:counters], [codeSets:sets], [codeDistribution:distributions], and [codeGauge:gauges].",
        {
          codeCounters: <code />,
          codeSets: <code />,
          codeDistribution: <code />,
          codeGauge: <code />,
          codeNamespace: <code />,
        }
      ),
      configurations: [
        {
          description: metricTagsExplanation,
        },
        {
          description: t('Try out these examples:'),
          code: [
            {
              label: 'Counter',
              value: 'counter',
              language: 'php',
              code: exampleSnippets.php.counter,
            },
            {
              label: 'Distribution',
              value: 'distribution',
              language: 'php',
              code: exampleSnippets.php.distribution,
            },
            {
              label: 'Set',
              value: 'set',
              language: 'php',
              code: exampleSnippets.php.set,
            },
            {
              label: 'Gauge',
              value: 'gauge',
              language: 'php',
              code: exampleSnippets.php.gauge,
            },
          ],
        },
        {
          description: t(
            'It can take up to 3 minutes for the data to appear in the Sentry UI.'
          ),
        },
        {
          description: tct(
            'Learn more about metrics and how to configure them, by reading the [docsLink:docs].',
            {
              docsLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/php/metrics/" />
              ),
            }
          ),
        },
      ],
    },
  ],
};

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportPHPInstallStep(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getCrashReportModalConfigDescription({
        link: 'https://docs.sentry.io/platforms/php/user-feedback/configuration/#crash-report-modal',
      }),
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
      description: t(
        'To capture all errors and transactions, even the one during the startup of your application, you should initialize the Sentry PHP SDK as soon as possible.'
      ),
      configurations: [
        {
          description: tct(
            'To initialize the SDK before everything else, create an external file called [code:instrument.js/mjs] and make sure to import it in your apps entrypoint before anything else.',
            {code: <code />}
          ),
          language: 'php',
          code: `
\\Sentry\\init([
  'dsn' => '${params.dsn.public}',

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  'traces_sample_rate' => 1.0,
]);
`,
          additionalInfo: tct(
            'We recommend adjusting the value of [code:tracesSampleRate] in production. Learn more about tracing [linkTracingOptions:options], how to use the [linkTracesSampler:traces_sampler] function, or how to [linkSampleTransactions:sample transactions].',
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
      description: tct(
        'Verify that performance monitoring is working correctly with our [link:automatic instrumentation] by simply using your Node application.',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/php/tracing/instrumentation/automatic-instrumentation/" />
          ),
        }
      ),
      additionalInfo: tct(
        'You have the option to manually construct a transaction using [link:custom instrumentation].',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/php/tracing/instrumentation/custom-instrumentation/" />
          ),
        }
      ),
    },
  ],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  customMetricsOnboarding,
  performanceOnboarding,
  crashReportOnboarding,
};

export default docs;

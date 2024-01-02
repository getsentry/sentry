import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import replayOnboardingJsLoader from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getConfigureSnippet = (params: Params) => `\\Sentry\\init([
  'dsn' => '${params.dsn}',${
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
    'metric_code_locations' => true,
]);`;

const getVerifySnippet = () => `
try {
  $this->functionFailsForSure();
} catch (\\Throwable $exception) {
  \\Sentry\\captureException($exception);
}`;

const getMetricsVerifySnippet = () => `
use function \\Sentry\\metrics;

// Add 4 to a counter named 'hits'
metrics()->increment('hits', 4);
metrics()->flush();

// We recommend registering the flushing in a shutdownhandler
register_shutdown_function(static fn () => metrics()->flush());`;

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
                    <ExternalLink href="https://docs.sentry.io/platforms/php/performance/instrumentation/custom-instrumentation/" />
                  ),
                }
              )}
            </p>
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
        "Then you'll be able to add metrics as [codeCounters:counters], [codeSets:sets], [codeDistribution:distributions], and [codeGauge:gauges]. Try out this example:",
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
          code: [
            {
              label: 'PHP',
              value: 'php',
              language: 'php',
              code: getMetricsVerifySnippet(),
            },
          ],
        },
        {
          description: t(
            'With a bit of delay you can see the data appear in the Sentry UI.'
          ),
        },
        {
          description: tct(
            'Learn more about metrics and how to configure them, by reading the [docsLink:docs].',
            {
              docsLink: (
                <ExternalLink href="https://github.com/getsentry/sentry-php/discussions/1666" />
              ),
            }
          ),
        },
      ],
    },
  ],
};

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  customMetricsOnboarding,
};

export default docs;

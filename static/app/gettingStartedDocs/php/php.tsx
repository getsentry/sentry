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

const onboarding: OnboardingConfig = {
  install: (params: Params) => [
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
          code: 'composer require sentry/sdk',
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
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: t(
        'To capture all errors, even the one during the startup of your application, you should initialize the Sentry PHP SDK as soon as possible.'
      ),
      configurations: [
        {
          language: 'php',
          code: `\\Sentry\\init([
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
  ]);`,
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
          code: `
  try {
    $this->functionFailsForSure();
  } catch (\\Throwable $exception) {
    \\Sentry\\captureException($exception);
  }`,
        },
      ],
    },
  ],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
};

export default docs;

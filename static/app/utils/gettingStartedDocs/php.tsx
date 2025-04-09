import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

const getProfilingConfigureSnippet = (params: DocsParams) => `\\Sentry\\init([
  'dsn' => '${params.dsn.public}',
  // Specify a fixed sample rate
  'traces_sample_rate' => 1.0,
  // Set a sampling rate for profiling - this is relative to traces_sample_rate
  'profiles_sample_rate' => 1.0
]);`;

export const getPhpProfilingOnboarding = (): OnboardingConfig => {
  return {
    install: params => [
      {
        type: StepType.INSTALL,
        description: tct(
          'To install the PHP SDK, you need to be using Composer in your project. For more details about Composer, see the [composerDocumentationLink:Composer documentation].',
          {
            composerDocumentationLink: (
              <ExternalLink href="https://getcomposer.org/doc/" />
            ),
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
          'To capture profiling data, you should initialize the Sentry PHP SDK as soon as possible.'
        ),
        configurations: [
          {
            language: 'php',
            code: getProfilingConfigureSnippet(params),
            additionalInfo: (
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
        ],
      },
    ],
    verify: () => [
      {
        type: StepType.VERIFY,
        description: t(
          'Verify that profiling is working correctly by simply using your application.'
        ),
        configurations: [],
      },
    ],
    nextSteps: () => [],
  };
};

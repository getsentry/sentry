import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

const getVerifySnippet = () => `
try {
  $this->functionFailsForSure();
} catch (\\Throwable $exception) {
  \\Sentry\\captureException($exception);
}`;

const getConfigureSnippet = (params: DocsParams) => `\\Sentry\\init([
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

export const onboarding: OnboardingConfig = {
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

import {Alert} from 'sentry/components/alert';
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
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const onboarding: OnboardingConfig = {
  introduction: () => (
    <p>
      {tct(
        'Symfony is supported via the [code:sentry-symfony] package as a native bundle.',
        {code: <code />}
      )}
    </p>
  ),
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      configurations: [
        {
          language: 'bash',
          description: tct('Install the [code:sentry/sentry-symfony] bundle:', {
            code: <code />,
          }),
          code: 'composer require sentry/sentry-symfony',
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
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      configurations: [
        {
          description: tct('Add your DSN to your [code:.env] file:', {code: <code />}),
          language: 'shell',
          code: `
###> sentry/sentry-symfony ###
SENTRY_DSN="${params.dsn.public}"
###< sentry/sentry-symfony ###
          `,
        },
        ...(params.isPerformanceSelected || params.isProfilingSelected
          ? [
              {
                description: tct(
                  'Add further configuration options to your [code:config/packages/sentry.yaml] file:',
                  {code: <code />}
                ),
                language: 'yaml',
                code: `when@prod:
      sentry:
          dsn: '%env(SENTRY_DSN)%'${
            params.isPerformanceSelected || params.isProfilingSelected
              ? `
          options:`
              : ''
          }${
            params.isPerformanceSelected
              ? `
              # Specify a fixed sample rate
              traces_sample_rate: 1.0`
              : ''
          }${
            params.isProfilingSelected
              ? `
              # Set a sampling rate for profiling - this is relative to traces_sample_rate
              profiles_sample_rate: 1.0`
              : ''
          }`,
              },
            ]
          : []),
        {
          description: (
            <Alert.Container>
              <Alert type="warning">
                {tct(
                  'In order to receive stack trace arguments in your errors, make sure to set [code:zend.exception_ignore_args: Off] in your php.ini',
                  {
                    code: <code />,
                  }
                )}
              </Alert>
            </Alert.Container>
          ),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      configurations: [
        {
          language: 'php',
          code: `
  <?php

  namespace App\\Controller;

  use Psr\\Log\\LoggerInterface;
  use Symfony\\Bundle\\FrameworkBundle\\Controller\\AbstractController;
  use Symfony\\Component\\Routing\\Annotation\\Route;

  class SentryTestController extends AbstractController {
    /**
     * @var LoggerInterface
     */
    private $logger;

    public function __construct(LoggerInterface $logger)
    {
      $this->logger = $logger;
    }

    /**
     * @Route(name="sentry_test", path="/_sentry-test")
     */
    public function testLog()
    {
      // the following code will test if monolog integration logs to sentry
      $this->logger->error('My custom logged error.');

      // the following code will test if an uncaught exception logs to sentry
      throw new \\RuntimeException('Example exception.');
    }
  }
          `,
        },
      ],
      additionalInfo: tct(
        "After you visit the [code:/_sentry-test page], you can view and resolve the recorded error by logging into [sentryLink:sentry.io] and opening your project. Clicking on the error's title will open a page where you can see detailed information and mark it as resolved.",
        {sentryLink: <ExternalLink href="https://sentry.io" />, code: <code />}
      ),
    },
  ],
  nextSteps: () => [],
};

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportPHPInstallStep(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getCrashReportModalConfigDescription({
        link: 'https://docs.sentry.io/platforms/php/guides/symfony/user-feedback/configuration/#crash-report-modal',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  crashReportOnboarding,
  feedbackOnboardingJsLoader,
};

export default docs;

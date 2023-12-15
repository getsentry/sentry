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
  introduction: () =>
    tct(
      'Symfony is supported via the [code:sentry-symfony] package as a native bundle.',
      {code: <code />}
    ),
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      configurations: [
        {
          language: 'bash',
          description: (
            <p>
              {tct('Install the [code:sentry/sentry-symfony] bundle:', {code: <code />})}
            </p>
          ),
          code: 'composer require sentry/sentry-symfony',
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
      configurations: [
        {
          description: (
            <p>{tct('Add your DSN to your [code:.env] file:', {code: <code />})}</p>
          ),
          language: 'shell',
          code: `
###> sentry/sentry-symfony ###
SENTRY_DSN="${params.dsn}"
###< sentry/sentry-symfony ###
          `,
        },
        ...(params.isPerformanceSelected || params.isProfilingSelected
          ? [
              {
                description: (
                  <p>
                    {tct(
                      'Add further configuration options to your [code:config/packages/sentry.yaml] file:',
                      {code: <code />}
                    )}
                  </p>
                ),
                language: 'yaml',
                code: `when@prod:
      sentry:
          dsn: '%env(SENTRY_DSN)%'${
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
      additionalInfo: (
        <p>
          {tct(
            "After you visit the [code:/_sentry-test page], you can view and resolve the recorded error by logging into [sentryLink:sentry.io] and opening your project. Clicking on the error's title will open a page where you can see detailed information and mark it as resolved.",
            {sentryLink: <ExternalLink href="https://sentry.io" />, code: <code />}
          )}
        </p>
      ),
    },
  ],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
};

export default docs;

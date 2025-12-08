import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {tct} from 'sentry/locale';

import {getConfigureSnippet, getExcimerInstallSteps} from './utils';

export const onboarding: OnboardingConfig = {
  introduction: () => (
    <p>
      {tct(
        'Symfony is supported via the [code:sentry-symfony] package as a native bundle.',
        {code: <code />}
      )}
    </p>
  ),
  install: (params: DocsParams) => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct('Install the [code:sentry/sentry-symfony] bundle:', {
            code: <code />,
          }),
        },
        {
          type: 'code',
          language: 'bash',
          code: 'composer require sentry/sentry-symfony',
        },
        ...getExcimerInstallSteps(params),
      ],
    },
  ],
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct('Add your DSN to your [code:.env] file:', {code: <code />}),
        },
        {
          type: 'code',
          language: 'shell',
          code: `
###> sentry/sentry-symfony ###
SENTRY_DSN="${params.dsn.public}"
###< sentry/sentry-symfony ###
          `,
        },
        ...getConfigureSnippet(params),
        {
          type: 'alert',
          alertType: 'warning',
          showIcon: false,
          text: tct(
            'In order to receive stack trace arguments in your errors, make sure to set [code:zend.exception_ignore_args: Off] in your php.ini',
            {code: <code />}
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
          type: 'code',
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
        {
          type: 'text',
          text: tct(
            "After you visit the [code:/_sentry-test page], you can view and resolve the recorded error by logging into [sentryLink:sentry.io] and opening your project. Clicking on the error's title will open a page where you can see detailed information and mark it as resolved.",
            {sentryLink: <ExternalLink href="https://sentry.io" />, code: <code />}
          ),
        },
      ],
    },
  ],
  nextSteps: () => [],
};

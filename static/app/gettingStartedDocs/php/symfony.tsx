import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';

interface StepsParams {
  dsn: string;
  hasPerformance: boolean;
  hasProfiling: boolean;
}

// Configuration Start
const introduction = (
  <p>
    {tct(
      'Symfony is supported via the [code:sentry-symfony] package as a native bundle.',
      {code: <code />}
    )}
  </p>
);

export const steps = ({
  dsn,
  hasPerformance,
  hasProfiling,
}: StepsParams): LayoutProps['steps'] => [
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
      ...(hasProfiling
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
SENTRY_DSN="${dsn}"
###< sentry/sentry-symfony ###
        `,
      },
      ...(hasPerformance || hasProfiling
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
          hasPerformance
            ? `
        # Specify a fixed sample rate
        traces_sample_rate: 1.0`
            : ''
        }${
          hasProfiling
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
  {
    type: StepType.VERIFY,
    description: (
      <p>
        {tct(
          'To test that both logger error and exception are correctly sent to [sentryLink:sentry.io], you can create the following controller:',
          {
            sentryLink: <ExternalLink href="https://sentry.io" />,
          }
        )}
      </p>
    ),
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
];
// Configuration End

export function GettingStartedWithSymfony({
  dsn,
  activeProductSelection = [],
  ...props
}: ModuleProps) {
  const hasPerformance = activeProductSelection.includes(
    ProductSolution.PERFORMANCE_MONITORING
  );
  const hasProfiling = activeProductSelection.includes(ProductSolution.PROFILING);
  return (
    <Layout
      introduction={introduction}
      steps={steps({dsn, hasPerformance, hasProfiling})}
      {...props}
    />
  );
}

export default GettingStartedWithSymfony;

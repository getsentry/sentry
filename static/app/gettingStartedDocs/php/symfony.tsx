import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
const introduction = tct(
  'Symfony is supported via the [code:sentry-symfony] package as a native bundle.',
  {code: <code />}
);

export const steps = ({
  dsn,
}: {
  dsn?: string;
} = {}): LayoutProps['steps'] => [
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
      {
        language: 'yaml',
        description: (
          <p>
            {tct(
              'Due to a bug in all versions below "6.0" of the [code:SensioFrameworkExtraBundle] bundle, you will likely receive an error during the execution of the command above related to the missing [code:NyholmPsr7FactoryPsr17Factory] class. To workaround the issue, if you are not using the PSR-7 bridge, please change the configuration of that bundle as follows:',
              {code: <code />}
            )}
          </p>
        ),
        code: `
sensio_framework_extra:
  psr_message:
  enabled: false
        `,
        additionalInfo: (
          <p>
            {tct(
              'For more details about the issue see [link:https://github.com/sensiolabs/SensioFrameworkExtraBundle/pull/710].',
              {
                link: (
                  <ExternalLink href="https://github.com/sensiolabs/SensioFrameworkExtraBundle/pull/710" />
                ),
              }
            )}
          </p>
        ),
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    configurations: [
      {
        description: (
          <p>
            {tct('Add your DSN to [code:config/packages/sentry.yaml]:', {code: <code />})}
          </p>
        ),
        language: 'php',
        code: `
sentry:
  dsn: "%env(${dsn})%"
        `,
      },
      {
        description: <p>{tct('And in your [code:.env] file:', {code: <code />})}</p>,
        language: 'plain',
        code: `
###> sentry/sentry-symfony ###
SENTRY_DSN="${dsn}"
###< sentry/sentry-symfony ###
        `,
      },
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

namespace App\Controller;

use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

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
    throw new \RuntimeException('Example exception.');
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
  {
    title: t('Performance monitoring'),
    description: (
      <Fragment>
        {t('Performance monitoring integrations to support tracing')}
        <p>
          {t(
            'The process of logging the events that took place during a request, often across multiple services are enabled by default. To use them, update to the latest version of the SDK.'
          )}
        </p>
        <p>
          {tct(
            'These integrations hook into critical paths of the framework and of the vendors. As a result, there may be a performance penalty. To disable tracing, please see the [integrationDocumentationLink:Integrations documentation].',
            {
              integrationDocumentationLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/php/guides/symfony/performance/instrumentation/automatic-instrumentation/" />
              ),
            }
          )}
        </p>
      </Fragment>
    ),
    configurations: [
      {
        description: (
          <p>
            {tct(
              "If you [strong:are not] using Symfony Flex, you'll also need to enable the bundle in [code:config/bundles.php]:",
              {
                code: <code />,
                strong: <strong />,
              }
            )}
          </p>
        ),
        language: 'php',
        code: `
<?php

  return [
    // ...
    Sentry\SentryBundle\SentryBundle::class => ['all' => true],
  ];
        `,
      },
    ],
  },
  {
    title: t('Monolog Integration'),
    configurations: [
      {
        description: (
          <p>
            {tct(
              'If you are using [monologLink:Monolog] to report events instead of the typical error listener approach, you need this additional configuration to log the errors correctly:',
              {
                monologLink: <ExternalLink href="https://github.com/Seldaek/monolog" />,
              }
            )}
          </p>
        ),
        language: 'yaml',
        code: `
sentry:
  register_error_listener: false # Disables the ErrorListener to avoid duplicated log in sentry
  register_error_handler: false # Disables the ErrorListener, ExceptionListener and FatalErrorListener integrations of the base PHP SDK

monolog:
  handlers:
    sentry:
      type: sentry
      level: !php/const Monolog\Logger::ERROR
      hub_id: Sentry\State\HubInterface
        `,
      },
      {
        description: (
          <p>
            {tct(
              'f you are using a version of [monologBundleLink:MonologBundle] prior to [code:3.7], you need to configure the handler as a service instead:',
              {
                monologBundleLink: (
                  <ExternalLink href="https://github.com/symfony/monolog-bundle" />
                ),
                code: <code />,
              }
            )}
          </p>
        ),
        language: 'yaml',
        code: `
monolog:
  handlers:
    sentry:
      type: service
      id: Sentry\Monolog\Handler

services:
  Sentry\Monolog\Handler:
    arguments:
      $hub: '@Sentry\State\HubInterface'
      $level: !php/const Monolog\Logger::ERROR
        `,
      },
      {
        description: (
          <p>
            {tct(
              'Additionally, you can register the [code:PsrLogMessageProcessor] to resolve PSR-3 placeholders in reported messages:',
              {
                code: <code />,
              }
            )}
          </p>
        ),
        language: 'yaml',
        code: `
services:
  Monolog\Processor\PsrLogMessageProcessor:
    tags: { name: monolog.processor, handler: sentry }
        `,
      },
    ],
  },
];
// Configuration End

export function GettingStartedWithSymfony({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} introduction={introduction} {...props} />;
}

export default GettingStartedWithSymfony;

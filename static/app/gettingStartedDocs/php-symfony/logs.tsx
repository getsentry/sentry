import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

export const logs: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Logs for Symfony are supported in version [code:4.12.0] and above of the Sentry PHP SDK and version [code:5.10.0] and above of the [code:sentry-symfony] bundle.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'text',
          text: t('Make sure you have the latest version of the Sentry Symfony bundle:'),
        },
        {
          type: 'code',
          language: 'bash',
          code: 'composer require sentry/sentry-symfony',
        },
      ],
    },
  ],
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'To enable logging, add the [code:enable_logs] option to your Sentry configuration:',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'yaml',
          code: `# config/packages/sentry.yaml
sentry:
    dsn: '${params.dsn.public}'
    options:
        enable_logs: true`,
        },
        {
          type: 'text',
          text: tct(
            'For integration with Monolog, see the [link:Symfony Logs documentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/php/guides/symfony/logs/" />
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
      content: [
        {
          type: 'text',
          text: t(
            'Once configured, you can send logs using the standard PSR-3 logger interface:'
          ),
        },
        {
          type: 'code',
          language: 'php',
          code: `use Psr\\Log\\LoggerInterface;

class SomeService
{
    public function __construct(
        private LoggerInterface $logger
    ) {}

    public function someMethod(): void
    {
        $this->logger->info('A test log message');
        $this->logger->error('An error log message', ['context' => 'value']);
    }
}`,
        },
      ],
    },
  ],
};

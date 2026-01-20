import {ExternalLink} from 'sentry/components/core/link';
import type {
  ContentBlock,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

export const logsVerify = (params: DocsParams): ContentBlock => ({
  type: 'conditional',
  condition: params.isLogsSelected,
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
      code: `$this->logger->info("This is an info message");
$this->logger->warning('User {id} failed to login.', ['id' => $user->id]);
$this->logger->error("This is an error message");`,
    },
    {
      type: 'text',
      text: tct(
        'Check out [link:the Logs documentation] to learn more about Monolog integration.',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/php/guides/symfony/logs/" />
          ),
        }
      ),
    },
  ],
});

export const logs: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Logs for Symfony are supported in Sentry Symfony SDK version [code:5.4.0] and above.',
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
          text: t(
            'To configure Sentry logging, add the Monolog handler to your configuration:'
          ),
        },
        {
          type: 'code',
          language: 'yaml',
          code: `# config/packages/monolog.yaml
monolog:
    handlers:
        sentry_logs:
            type: service
            id: Sentry\\SentryBundle\\Monolog\\LogsHandler`,
        },
        {
          type: 'text',
          text: t('Configure the service and choose a minimum log level:'),
        },
        {
          type: 'code',
          language: 'yaml',
          code: `# config/packages/sentry.yaml
services:
    Sentry\\SentryBundle\\Monolog\\LogsHandler:
        arguments:
            - !php/const Monolog\\Logger::INFO`,
        },
        {
          type: 'text',
          text: t('Enable the logs option:'),
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
          text: tct('For more details, see the [link:Symfony Logs documentation].', {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/php/guides/symfony/logs/" />
            ),
          }),
        },
      ],
    },
  ],
  verify: (params: DocsParams) => [
    {
      type: StepType.VERIFY,
      content: [logsVerify(params)],
    },
  ],
};

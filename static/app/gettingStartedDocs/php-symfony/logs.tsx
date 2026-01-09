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
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: tct(
            'Once you have configured the Sentry log handler, you can use your regular [code:LoggerInterface]. It will send logs to Sentry:',
            {
              code: <code />,
            }
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
          text: t(
            'You can pass additional attributes directly to the logging functions. These properties will be sent to Sentry, and can be searched from within the Logs UI:'
          ),
        },
        {
          type: 'code',
          language: 'php',
          code: `$this->logger->error('Something went wrong', [
    'user_id' => $userId,
    'action' => 'update_profile',
    'additional_data' => $data,
]);`,
        },
      ],
    },
  ],
};

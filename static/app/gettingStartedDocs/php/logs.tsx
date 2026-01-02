import {ExternalLink} from 'sentry/components/core/link';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
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
            'To start using logs, install the latest version of the Sentry PHP SDK. Logs are supported in version [code:4.12.0] and above of the SDK.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'bash',
          code: 'composer require sentry/sentry',
        },
        {
          type: 'text',
          text: tct(
            'If you are on an older version of the SDK, follow our [link:migration guide] to upgrade.',
            {
              link: (
                <ExternalLink href="https://github.com/getsentry/sentry-php/blob/master/UPGRADE-4.0.md" />
              ),
            }
          ),
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
          text: tct(
            'To enable logging, you need to initialize the SDK with the [code:enable_logs] option set to [code:true].',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'php',
          code: `\\Sentry\\init([
  'dsn' => '${params.dsn.public}',
  'enable_logs' => true,
]);

// Somewhere at the end of your execution, you should flush
// the logger to send pending logs to Sentry.
\\Sentry\\logger()->flush();`,
        },
        {
          type: 'text',
          text: tct(
            'For more detailed configuration options, see the [link:logs documentation].',
            {
              link: <ExternalLink href="https://docs.sentry.io/platforms/php/logs/" />,
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
            'Verify that logging is working correctly by sending logs via the Sentry logger.'
          ),
        },
        {
          type: 'code',
          language: 'php',
          code: `\\Sentry\\logger()->info('A test log message');

// Somewhere at the end of your execution, you should flush
// the logger to send pending logs to Sentry.
\\Sentry\\logger()->flush();`,
        },
      ],
    },
  ],
};

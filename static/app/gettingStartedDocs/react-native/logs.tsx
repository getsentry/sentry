import {ExternalLink} from '@sentry/scraps/link';

import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

export const logs: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Logs for React Native are supported in Sentry React Native SDK version [code:7.0.0] and above. If you are using an older version of the SDK, follow our [link:migration guide] to upgrade.',
            {
              code: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/react-native/migration/" />
              ),
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'npm',
              language: 'bash',
              code: `npm install --save @sentry/react-native@${getPackageVersion(
                params,
                '@sentry/react-native',
                '7.0.0'
              )}`,
            },
            {
              label: 'yarn',
              language: 'bash',
              code: `yarn add @sentry/react-native@${getPackageVersion(
                params,
                '@sentry/react-native',
                '7.0.0'
              )}`,
            },
            {
              label: 'pnpm',
              language: 'bash',
              code: `pnpm add @sentry/react-native@${getPackageVersion(
                params,
                '@sentry/react-native',
                '7.0.0'
              )}`,
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
          text: tct(
            'To enable logging, you need to initialize the SDK with the [code:enableLogs] option set to true.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: `import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: '${params.dsn.public}',
  // Enable logs to be sent to Sentry
  enableLogs: true,
});`,
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
          text: t('Send a test log from your app to verify logs are arriving in Sentry.'),
        },
        {
          type: 'code',
          language: 'javascript',
          code: `import * as Sentry from '@sentry/react-native';

// Send different log levels
Sentry.logger.info('This is an info log');

Sentry.logger.warn('This is a warning log', {
  attributes: {
    log_type: 'test',
  },
});

Sentry.logger.error('This is an error log');

// Using formatted messages with dynamic values
Sentry.logger.fmt(
  'User {user} performed {action}',
  {
    user: 'john_doe',
    action: 'login',
  }
);`,
        },
        {
          type: 'text',
          text: tct(
            'For more detailed information, see the [link:logs documentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/react-native/logs/" />
              ),
            }
          ),
        },
      ],
    },
  ],
};

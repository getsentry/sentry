import {ExternalLink} from '@sentry/scraps/link';

import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

import {installCodeBlock} from './utils';

export const logs: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: t(
            'Make sure your Sentry React Native SDK version is at least 7.0.0. If you already have the SDK installed, you can update it to the latest version with:'
          ),
        },
        installCodeBlock,
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
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: `import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: "${params.dsn.public}",
  // Enable logs to be sent to Sentry
  enableLogs: true,
});`,
            },
          ],
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
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: `import * as Sentry from "@sentry/react-native";

// Send different log levels
Sentry.logger.info('This is an info log');

Sentry.logger.warn('This is a warning log', {
  log_type: 'test',
});

Sentry.logger.error('This is an error log');

// Using formatted messages with dynamic values
const user = 'john_doe';
const action = 'login';
Sentry.logger.info(
  Sentry.logger.fmt\`User '\${user}' performed '\${action}'\`
);`,
            },
          ],
        },
        {
          type: 'text',
          text: tct('For more detailed information, see the [link:logs documentation].', {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/react-native/logs/" />
            ),
          }),
        },
      ],
    },
  ],
};

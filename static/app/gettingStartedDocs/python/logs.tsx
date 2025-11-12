import {ExternalLink} from 'sentry/components/core/link';
import {
  StepType,
  type ContentBlock,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

import {getPythonInstallCodeBlock} from './utils';

export const logsVerify = (params: DocsParams): ContentBlock => ({
  type: 'conditional',
  condition: params.isLogsSelected,
  content: [
    {
      type: 'text',
      text: t('You can send logs to Sentry using the Sentry logging APIs:'),
    },
    {
      type: 'code',
      language: 'python',
      code: `import sentry_sdk

# Send logs directly to Sentry
sentry_sdk.logger.info('This is an info log message')
sentry_sdk.logger.warning('This is a warning message')
sentry_sdk.logger.error('This is an error message')`,
    },
    {
      type: 'text',
      text: t(
        "You can also use Python's built-in logging module, which will automatically forward logs to Sentry:"
      ),
    },
    {
      type: 'code',
      language: 'python',
      code: `import logging

# Your existing logging setup
logger = logging.getLogger(__name__)

# These logs will be automatically sent to Sentry
logger.info('This will be sent to Sentry')
logger.warning('User login failed')
logger.error('Something went wrong')`,
    },
  ],
});

export const logs = ({
  packageName = 'sentry-sdk',
}: {
  packageName?: string;
} = {}): OnboardingConfig => ({
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Install our Python SDK with a minimum version that supports logs ([code:2.35.0] or higher).',
            {
              code: <code />,
            }
          ),
        },
        getPythonInstallCodeBlock({
          packageName,
          minimumVersion: '2.35.0',
        }),
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
            'Configure the Sentry SDK to capture logs by setting [code:enable_logs=True] in your [code:sentry_sdk.init()] call:',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `import sentry_sdk

sentry_sdk.init(
    dsn="${params.dsn.public}",
    # Enable logs to be sent to Sentry
    enable_logs=True,
)`,
        },
        {
          type: 'text',
          text: tct(
            'For more detailed information on logging configuration, see the [link:logs documentation].',
            {
              link: <ExternalLink href="https://docs.sentry.io/platforms/python/logs/" />,
            }
          ),
        },
      ],
    },
  ],
  verify: (params: DocsParams) => [
    {
      type: StepType.VERIFY,
      description: t('Test that logs are working by sending some test logs:'),
      content: [logsVerify(params)],
    },
  ],
});

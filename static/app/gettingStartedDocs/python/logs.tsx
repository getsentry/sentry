import {ExternalLink} from '@sentry/scraps/link';

import {
  StepType,
  type ContentBlock,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

import {getPythonInstallCodeBlock} from './utils';

const LOGS_MINIMUM_SDK_VERSION = '2.68.0';

export const logsVerify = (params: DocsParams): ContentBlock => ({
  type: 'conditional',
  condition: params.isLogsSelected,
  content: [
    {
      type: 'text',
      text: tct(
        'Logs require Python SDK version [minimumVersion] or higher. If you already have an older version installed, upgrade it with [code:pip install --upgrade sentry-sdk].',
        {
          code: <code />,
          minimumVersion: <code>{LOGS_MINIMUM_SDK_VERSION}</code>,
        }
      ),
    },
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
      text: tct(
        "You can also forward logs from Python's built-in logging module by setting [code:capture_sentry_logs=True] on the [code:LoggingIntegration]:",
        {
          code: <code />,
        }
      ),
    },
    {
      type: 'code',
      language: 'python',
      code: `import logging

import sentry_sdk
from sentry_sdk.integrations.logging import LoggingIntegration

sentry_sdk.init(
    # ...
    integrations=[
        LoggingIntegration(capture_sentry_logs=True),
    ],
)

# Your existing logging setup
logger = logging.getLogger(__name__)

# These logs will be automatically sent to Sentry
logger.info('This will be sent to Sentry')
logger.warning('User login failed')
logger.error('Something went wrong')`,
    },
  ],
});

export const logs = (): OnboardingConfig => ({
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Install our Python SDK with a minimum version that supports logs ([minimumVersion] or higher).',
            {
              minimumVersion: <code>{LOGS_MINIMUM_SDK_VERSION}</code>,
            }
          ),
        },
        getPythonInstallCodeBlock({
          minimumVersion: LOGS_MINIMUM_SDK_VERSION,
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
            'Logs are enabled by default, so no extra configuration is needed in your [code:sentry_sdk.init()] call:',
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

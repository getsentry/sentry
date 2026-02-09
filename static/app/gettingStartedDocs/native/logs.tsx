import {ExternalLink} from '@sentry/scraps/link';

import type {
  ContentBlock,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {tct} from 'sentry/locale';

export const logsVerify = (params: DocsParams): ContentBlock => ({
  type: 'conditional',
  condition: params.isLogsSelected,
  content: [
    {
      type: 'text',
      text: tct(
        'Once logging is enabled, you can send logs using the [code:sentry_log_X()] APIs:',
        {
          code: <code />,
        }
      ),
    },
    {
      type: 'code',
      language: 'c',
      code: `sentry_log_info("A simple log message");
sentry_log_error("A %s log message", "formatted");`,
    },
    {
      type: 'text',
      text: tct(
        'Check out [link:the Logs documentation] to learn more about additional attributes and options.',
        {
          link: <ExternalLink href="https://docs.sentry.io/platforms/native/logs/" />,
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
            'Logs in Native are supported in Sentry Native SDK version [code:0.11.1] and above.',
            {
              code: <code />,
            }
          ),
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
            'To enable logging, you need to initialize the SDK with the [code:enable_logs] option set to [code:true].',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'c',
          code: `sentry_options_t *options = sentry_options_new();
sentry_options_set_dsn(options, "${params.dsn.public}");
sentry_options_set_enable_logs(options, 1);
// set other options
sentry_init(options);`,
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

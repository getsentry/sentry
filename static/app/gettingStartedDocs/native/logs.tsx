import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {tct} from 'sentry/locale';

export const logs: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Logs in Native are supported in Sentry Native SDK version [link:0.11.1] and above.',
            {
              link: (
                <ExternalLink href="https://github.com/getsentry/sentry-native/releases/tag/0.11.1" />
              ),
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
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: tct(
            'Once the feature is enabled on the SDK and the SDK is initialized, you can send logs using the [code:sentry_log_X()] APIs.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'text',
          text: tct(
            'The API exposes six methods that you can use to log messages at different log levels: [code:trace], [code:debug], [code:info], [code:warn], [code:error], and [code:fatal].',
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
      ],
    },
  ],
};

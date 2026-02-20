import {ExternalLink} from '@sentry/scraps/link';

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
        "Once logging is enabled, you can send logs using the SentrySDK.logger API or Godot's built-in logging functions:"
      ),
    },
    {
      type: 'code',
      language: 'gdscript',
      code: `# Use the logger API directly
SentrySDK.logger.info("Level loaded successfully")
SentrySDK.logger.warn("Item configuration not found")
SentrySDK.logger.error("Failed to save game state")

# Or use Godot's built-in functions (automatically captured)
print("This info message will be sent to Sentry")
push_warning("This warning will be sent to Sentry")
push_error("This error will be sent to Sentry")`,
    },
    {
      type: 'text',
      text: tct('Check out [link:the Logs documentation] to learn more.', {
        link: <ExternalLink href="https://docs.sentry.io/platforms/godot/logs/" />,
      }),
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
            'Logs for Godot Engine are supported in Sentry SDK version [code:1.1.0] and above.',
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
          text: t(
            'To enable structured logs, navigate to Project Settings in Godot, then go to Sentry > Options and enable the Enable Logs option.'
          ),
        },
        {
          type: 'text',
          text: t(
            'Alternatively, you can configure logging programmatically when initializing the SDK:'
          ),
        },
        {
          type: 'code',
          language: 'gdscript',
          code: `SentrySDK.init(func(options: SentryOptions) -> void:
    options.dsn = "${params.dsn.public}"

    # Enable logs
    options.enable_logs = true
)`,
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

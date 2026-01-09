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
            'Logs for Unity are supported in Sentry SDK version [code:4.0.0] and above.',
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
            'To enable logging in your Unity game, you need to configure the Sentry SDK with structured logging enabled.'
          ),
        },
        {
          type: 'text',
          text: tct(
            'Open your project settings: [strong:Tools > Sentry > Logging] and check the [strong:Enable Structured Logging] option.',
            {
              strong: <strong />,
            }
          ),
        },
        {
          type: 'text',
          text: t('Alternatively, you can enable logging programmatically:'),
        },
        {
          type: 'code',
          language: 'csharp',
          code: `SentrySdk.Init(options =>
{
    options.Dsn = "${params.dsn.public}";

    // Enable logs to be sent to Sentry
    options.EnableLogs = true;
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
          text: tct(
            'Once the feature is enabled and the SDK is initialized, you can send logs using the [code:SentrySdk.Logger] API:',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'csharp',
          code: `SentrySdk.Logger.LogInfo("A simple debug log message");
SentrySdk.Logger.LogError("A {0} log message", "formatted");`,
        },
        {
          type: 'text',
          text: tct(
            "You can also use Unity's standard Debug logging. By default, [code:Debug.LogWarning] and above are automatically captured. [code:Debug.Log] calls are not sent unless you set [code:options.CaptureStructuredLogsForLogType[LogType.Log] = true].",
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'csharp',
          code: `// Debug.LogWarning and above are captured by default
Debug.LogWarning("Low memory warning.");
Debug.LogError("Failed to save game data.");

// Debug.Log requires explicit opt-in via CaptureStructuredLogsForLogType[LogType.Log] = true
Debug.Log("Player position updated.");`,
        },
        {
          type: 'text',
          text: t(
            'You can pass additional attributes directly to the logging functions. These properties will be sent to Sentry, and can be searched from within the Logs UI:'
          ),
        },
        {
          type: 'code',
          language: 'csharp',
          code: `SentrySdk.Logger.LogWarning(static log =>
{
    log.SetAttribute("my.attribute", "value");
}, "A log message with additional attributes.");`,
        },
        {
          type: 'text',
          text: tct(
            'For more configuration options, see the [link:Unity Logs documentation].',
            {
              link: <ExternalLink href="https://docs.sentry.io/platforms/unity/logs/" />,
            }
          ),
        },
      ],
    },
  ],
};

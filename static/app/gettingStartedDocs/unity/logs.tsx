import {ExternalLink} from 'sentry/components/core/link';
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
        'Once logging is enabled, you can send logs using the Debug.Log API or directly via the SDK:'
      ),
    },
    {
      type: 'code',
      language: 'csharp',
      code: `using Sentry;
using UnityEngine;

// Unity's Debug.LogWarning (and higher severity levels) will automatically be captured
Debug.LogWarning("This warning will be sent to Sentry");

// Or use the SDK directly
SentrySdk.Logger.LogInfo("A simple log message");
SentrySdk.Logger.LogError("A {0} log message", "formatted");`,
    },
    {
      type: 'text',
      text: tct('Check out [link:the Logs documentation] to learn more.', {
        link: <ExternalLink href="https://docs.sentry.io/platforms/unity/logs/" />,
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
  verify: (params: DocsParams) => [
    {
      type: StepType.VERIFY,
      content: [logsVerify(params)],
    },
  ],
};

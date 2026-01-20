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
      text: t('Send a test log from your app to verify logs are arriving in Sentry.'),
    },
    {
      type: 'code',
      language: 'cpp',
      code: `USentrySubsystem* SentrySubsystem = GEngine->GetEngineSubsystem<USentrySubsystem>();

// Send logs at different severity levels
SentrySubsystem->LogInfo(TEXT("Test log message"), TEXT("Test"));
SentrySubsystem->LogWarning(TEXT("Warning message"), TEXT("Test"));
SentrySubsystem->LogError(TEXT("Error message"), TEXT("Test"));`,
    },
    {
      type: 'text',
      text: tct(
        'You can also automatically capture Unreal Engine [code:UE_LOG] calls. Check out [link:the Logs documentation] to learn more.',
        {
          code: <code />,
          link: <ExternalLink href="https://docs.sentry.io/platforms/unreal/logs/" />,
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
            'Logs for Unreal Engine are supported in Sentry Unreal Engine SDK version [code:1.2.0] and above.',
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
            'To enable logging in your Unreal Engine project, you need to configure the Sentry SDK with structured logging enabled.'
          ),
        },
        {
          type: 'text',
          text: tct(
            'Open your project settings: [strong:Project Settings > Plugins > Sentry] and check the [strong:Enable Structured Logging] option.',
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
          language: 'cpp',
          code: `#include "SentrySubsystem.h"

USentrySubsystem* SentrySubsystem = GEngine->GetEngineSubsystem<USentrySubsystem>();

// Create settings with logging enabled
SentrySubsystem->InitializeWithSettings(FConfigureSettingsNativeDelegate::CreateLambda([=](USentrySettings* Settings)
{
    Settings->Dsn = TEXT("${params.dsn.public}");
    Settings->EnableStructuredLogging = true;
}));`,
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

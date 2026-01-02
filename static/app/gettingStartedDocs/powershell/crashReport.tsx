import altCrashReportCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/altCrashReportCallout';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportApiIntroduction,
  getCrashReportInstallDescription,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';

export const crashReport: OnboardingConfig = {
  introduction: () => getCrashReportApiIntroduction(),
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: getCrashReportInstallDescription(),
        },
        {
          type: 'code',
          language: 'powershell',
          code: `$eventId = "An event that will receive user feedback." | Out-Sentry
[Sentry.SentrySdk]::CaptureUserFeedback($eventId, "user@example.com", "It broke.", "The User")`,
        },
        {
          type: 'custom',
          content: altCrashReportCallout(),
        },
      ],
    },
  ],
  configure: () => [],
  verify: () => [],
  nextSteps: () => [],
};

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
          tabs: [
            {
              label: 'C#',
              language: 'csharp',
              code: `var eventId = SentrySdk.CaptureMessage("An event that will receive user feedback.");

SentrySdk.CaptureUserFeedback(eventId, "user@example.com", "It broke.", "The User");`,
            },
            {
              label: 'F#',
              language: 'fsharp',
              code: `let eventId = SentrySdk.CaptureMessage("An event that will receive user feedback.")

SentrySdk.CaptureUserFeedback(eventId, "user@example.com", "It broke.", "The User")`,
            },
          ],
        },
      ],
    },
  ],
  configure: () => [],
  verify: () => [],
  nextSteps: () => [],
};

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
              label: 'C++',
              language: 'cpp',
              code: `USentrySubsystem* SentrySubsystem = GEngine->GetEngineSubsystem<USentrySubsystem>();

USentryId* EventId = SentrySubsystem->CaptureMessage(TEXT("Message with feedback"));

USentryUserFeedback* UserFeedback = NewObject<USentryUserFeedback>();
User->Initialize(EventId);
User->SetEmail("test@sentry.io");
User->SetName("Name");
User->SetComment("Some comment");

SentrySubsystem->CaptureUserFeedback(UserFeedback);

// OR

SentrySubsystem->CaptureUserFeedbackWithParams(EventId, "test@sentry.io", "Some comment", "Name");`,
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

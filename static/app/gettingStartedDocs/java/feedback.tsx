import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportApiIntroduction,
  getCrashReportInstallDescription,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';

export const feedback: OnboardingConfig = {
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
              label: 'Java',
              language: 'java',
              code: `import io.sentry.Sentry;
import io.sentry.UserFeedback;

SentryId sentryId = Sentry.captureMessage("My message");

UserFeedback userFeedback = new UserFeedback(sentryId);
userFeedback.setComments("It broke.");
userFeedback.setEmail("john.doe@example.com");
userFeedback.setName("John Doe");
Sentry.captureUserFeedback(userFeedback);`,
            },
            {
              label: 'Kotlin',
              language: 'kotlin',
              code: `import io.sentry.Sentry
import io.sentry.UserFeedback

val sentryId = Sentry.captureMessage("My message")

val userFeedback = UserFeedback(sentryId).apply {
  comments = "It broke."
  email = "john.doe@example.com"
  name = "John Doe"
}
Sentry.captureUserFeedback(userFeedback)`,
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

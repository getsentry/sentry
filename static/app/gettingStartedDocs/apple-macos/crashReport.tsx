import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportApiIntroduction,
  getCrashReportInstallDescription,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {tct} from 'sentry/locale';

export const crashReport: OnboardingConfig = {
  introduction: () => getCrashReportApiIntroduction(),
  install: (params: DocsParams) => [
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
              label: 'Swift',
              language: 'swift',
              code: `import Sentry

let eventId = SentrySDK.capture(message: "My message.")

let userFeedback = UserFeedback(eventId: eventId)
userFeedback.comments = "It broke."
userFeedback.email = "john.doe@example.com"
userFeedback.name = "John Doe"
SentrySDK.capture(userFeedback: userFeedback)`,
            },
            {
              label: 'Objective-C',
              language: 'c',
              code: `@import Sentry;

SentryId *eventId = [SentrySDK captureMessage:@"My message"];

SentryUserFeedback *userFeedback = [[SentryUserFeedback alloc] initWithEventId:eventId];
userFeedback.comments = @"It broke.";
userFeedback.email = @"john.doe@example.com";
userFeedback.name = @"John Doe";
[SentrySDK captureUserFeedback:userFeedback];`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'To capture user feedback regarding a crash, use the [code:SentryOptions.onCrashedLastRun] callback. This callback gets called shortly after the initialization of the SDK when the last program execution terminated with a crash. It is not guaranteed that this is called on the main thread.',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Swift',
              language: 'swift',
              code: `import Sentry

SentrySDK.start { options in
    options.dsn = "${params.dsn.public}"
    options.onCrashedLastRun = { event in
        // capture user feedback
    }
}
`,
            },
            {
              label: 'Objective-C',
              language: 'c',
              code: `@import Sentry;

[SentrySDK startWithConfigureOptions:^(SentryOptions *options) {
    options.dsn = @"${params.dsn.public}";
    options.onCrashedLastRun = ^void(SentryEvent * _Nonnull event) {
        // capture user feedback
    };
}];`,
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

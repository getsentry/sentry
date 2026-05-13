import {
  StepType,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
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
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: `// Use the import for your runtime:
// "@sentry/hono/cloudflare", "@sentry/hono/node", or "@sentry/hono/bun"
import * as Sentry from "@sentry/hono/<your-runtime>";

const userFeedback = {
  name: "John Doe",
  email: "john@doe.com",
  message: "I really like your App, thanks!",
};
Sentry.captureFeedback(userFeedback);
`,
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

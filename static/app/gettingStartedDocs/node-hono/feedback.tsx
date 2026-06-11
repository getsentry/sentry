import {
  StepType,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportApiIntroduction,
  getCrashReportInstallDescription,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';

function getFeedbackSnippet(importPath: `@sentry/${string}/${string}`): string {
  return `import * as Sentry from "${importPath}";

const userFeedback = {
  name: "John Doe",
  email: "john@doe.com",
  message: "I really like your App, thanks!",
};
Sentry.captureFeedback(userFeedback);
`;
}

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
              label: 'Cloudflare',
              value: 'cloudflare',
              language: 'javascript',
              code: getFeedbackSnippet('@sentry/hono/cloudflare'),
            },
            {
              label: 'Node',
              value: 'node',
              language: 'javascript',
              code: getFeedbackSnippet('@sentry/hono/node'),
            },
            {
              label: 'Bun',
              value: 'bun',
              language: 'javascript',
              code: getFeedbackSnippet('@sentry/hono/bun'),
            },
            {
              label: 'Deno',
              value: 'deno',
              language: 'javascript',
              code: getFeedbackSnippet('@sentry/hono/deno'),
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

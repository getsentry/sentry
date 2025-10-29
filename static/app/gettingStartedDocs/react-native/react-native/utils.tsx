import type {
  ContentBlock,
  DocsParams,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getFeedbackConfigOptions} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';

export const installCodeBlock: ContentBlock = {
  type: 'code',
  tabs: [
    {
      label: 'npm',
      language: 'bash',
      code: `npm install @sentry/react-native --save`,
    },
    {
      label: 'yarn',
      language: 'bash',
      code: `yarn add @sentry/react-native`,
    },
    {
      label: 'pnpm',
      language: 'bash',
      code: `pnpm add @sentry/react-native`,
    },
  ],
};

export const getConfigureSnippet = (params: DocsParams) => `
import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: "${params.dsn.public}",
  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,${
    params.isPerformanceSelected
      ? `
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
  // We recommend adjusting this value in production.
  tracesSampleRate: 1.0,`
      : ''
  }${
    params.isProfilingSelected
      ? `
  // profilesSampleRate is relative to tracesSampleRate.
  // Here, we'll capture profiles for 100% of transactions.
  profilesSampleRate: 1.0,`
      : ''
  }${
    params.isReplaySelected
      ? `
  // Record Session Replays for 10% of Sessions and 100% of Errors
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.mobileReplayIntegration()],`
      : ''
  }${
    params.isLogsSelected
      ? `
  // Enable logs to be sent to Sentry
  // Learn more at https://docs.sentry.io/platforms/react-native/logs/
  enableLogs: true,`
      : ''
  }
});`;

export const getReplaySetupSnippet = (params: DocsParams) => `
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: "${params.dsn.public}",
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.mobileReplayIntegration(),
  ],
});`;

export const getReplayConfigurationSnippet = () => `
Sentry.mobileReplayIntegration({
  maskAllText: true,
  maskAllImages: true,
  maskAllVectors: true,
}),`;

export const getFeedbackConfigureSnippet = (params: DocsParams) => `
import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: "${params.dsn.public}",
  integrations: [
    Sentry.feedbackIntegration({
      // Additional SDK configuration goes in here, for example:
      styles: {
        submitButton: {
          backgroundColor: "#6a1b9a",
        },
      },
      namePlaceholder: "Fullname",
      ${getFeedbackConfigOptions(params.feedbackOptions)}
    }),
  ],
});
`;

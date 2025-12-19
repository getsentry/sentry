import {buildSdkConfig} from 'sentry/components/onboarding/gettingStartedDoc/buildSdkConfig';
import type {
  ContentBlock,
  DocsParams,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getFeedbackConfigOptions} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {getReplayConfigOptions} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {tct} from 'sentry/locale';

const getIntegrations = (params: DocsParams): string[] => {
  const integrations = [];
  if (params.isPerformanceSelected) {
    integrations.push(`Sentry.browserTracingIntegration()`);
  }

  if (params.isProfilingSelected) {
    integrations.push(`Sentry.browserProfilingIntegration()`);
  }

  if (params.isReplaySelected) {
    integrations.push(
      `Sentry.replayIntegration(${getReplayConfigOptions(params.replayOptions)})`
    );
  }

  if (params.isFeedbackSelected) {
    integrations.push(`
      Sentry.feedbackIntegration({
        colorScheme: "system",
        ${getFeedbackConfigOptions(params.feedbackOptions)}
      }),`);
  }

  return integrations;
};

const getDynamicParts = (params: DocsParams): string[] => {
  const dynamicParts: string[] = [];

  if (params.isLogsSelected) {
    dynamicParts.push(`
      // Enable sending logs to Sentry
      enableLogs: true`);
  }

  if (params.isReplaySelected) {
    dynamicParts.push(`
      // Session Replay
      replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
      replaysOnErrorSampleRate: 1.0 // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.`);
  }

  if (params.isPerformanceSelected) {
    dynamicParts.push(`
      // Tracing
      tracesSampleRate: 1.0, //  Capture 100% of the transactions
      // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
      tracePropagationTargets: ["localhost", /^https:\\/\\/yourserver\\.io\\/api/]`);
  }

  if (params.isProfilingSelected) {
    dynamicParts.push(`
        // Set profileSessionSampleRate to 1.0 to profile during every session.
        // The decision, whether to profile or not, is made once per session (when the SDK is initialized).
        profileSessionSampleRate: 1.0`);
  }

  return dynamicParts;
};

export function getSdkSetupSnippet(params: DocsParams) {
  const config = buildSdkConfig({
    params,
    staticParts: [
      `dsn: "${params.dsn.public}"`,
      `// Setting this option to true will send default PII data to Sentry.
      // For example, automatic IP address collection on events
      sendDefaultPii: true`,
    ],
    getIntegrations,
    getDynamicParts,
  });

  return `
import * as Sentry from "@sentry/gatsby";

Sentry.init({
  ${config}
});`;
}

export function getConfigureStep(params: DocsParams): OnboardingStep {
  return {
    type: StepType.CONFIGURE,
    content: [
      {
        type: 'text',
        text: tct(
          'Register the [code:@sentry/gatsby] plugin in your Gatsby configuration file (typically [code:gatsby-config.js]).',
          {code: <code />}
        ),
      },
      {
        type: 'code',
        tabs: [
          {
            label: 'JavaScript',
            language: 'javascript',
            code: `module.exports = {
            plugins: [{
              resolve: "@sentry/gatsby",
            }],
          };`,
          },
        ],
      },
      {
        type: 'text',
        text: tct(
          'Then create a new file called [codeSentry:sentry.config.js] in the root of your project and add the following Sentry configuration:',
          {codeSentry: <code />}
        ),
      },
      {
        type: 'code',
        tabs: [
          {
            label: 'JavaScript',
            language: 'javascript',
            filename: 'sentry.config.js',
            code: getSdkSetupSnippet(params),
          },
        ],
      },
    ],
  };
}

export const installSnippetBlock: ContentBlock = {
  type: 'code',
  tabs: [
    {
      label: 'npm',
      language: 'bash',
      code: 'npm install --save @sentry/gatsby',
    },
    {
      label: 'yarn',
      language: 'bash',
      code: 'yarn add @sentry/gatsby',
    },
    {
      label: 'pnpm',
      language: 'bash',
      code: 'pnpm add @sentry/gatsby',
    },
  ],
};

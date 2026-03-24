import {buildSdkConfig} from 'sentry/components/onboarding/gettingStartedDoc/buildSdkConfig';
import type {
  ContentBlock,
  DocsParams,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getFeedbackConfigOptions} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {getReplayConfigOptions} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';

const getIntegrations = (params: DocsParams): string[] => {
  const integrations = [];
  if (params.isPerformanceSelected) {
    integrations.push(`solidRouterBrowserTracingIntegration()`);
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
    integrations.push(
      `
        Sentry.feedbackIntegration({
          // Additional SDK configuration goes in here, for example:
          colorScheme: "system",
          ${getFeedbackConfigOptions(params.feedbackOptions)}
        })`
    );
  }

  return integrations;
};

const getDynamicParts = (params: DocsParams): string[] => {
  const dynamicParts: string[] = [];

  if (params.isPerformanceSelected) {
    dynamicParts.push(`
      // Tracing
      tracesSampleRate: 1.0, //  Capture 100% of the transactions
      // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
      tracePropagationTargets: ["localhost", /^https:\\/\\/yourserver\\.io\\/api/]`);
  }

  if (params.isReplaySelected) {
    dynamicParts.push(`
      // Session Replay
      replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
      replaysOnErrorSampleRate: 1.0 // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.`);
  }

  if (params.isProfilingSelected) {
    dynamicParts.push(`
        // Set profileSessionSampleRate to 1.0 to profile during every session.
        // The decision, whether to profile or not, is made once per session (when the SDK is initialized).
        profileSessionSampleRate: 1.0`);
  }

  return dynamicParts;
};

export function getSdkClientSetupSnippet(params: DocsParams) {
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
import * as Sentry from "@sentry/solidstart";
${params.isPerformanceSelected ? 'import { solidRouterBrowserTracingIntegration } from "@sentry/solidstart/solidrouter";' : ''}
import { mount, StartClient } from "@solidjs/start/client";

Sentry.init({
  ${config}
});

mount(() => <StartClient />, document.getElementById("app"));
`;
}

export const installSnippetBlock: ContentBlock = {
  type: 'code',
  tabs: [
    {
      label: 'npm',
      language: 'bash',
      code: 'npm install --save @sentry/solidstart',
    },
    {
      label: 'yarn',
      language: 'bash',
      code: 'yarn add @sentry/solidstart',
    },
    {
      label: 'pnpm',
      language: 'bash',
      code: `pnpm add @sentry/solidstart`,
    },
  ],
};

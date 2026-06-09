import {buildSdkConfig} from 'sentry/components/onboarding/gettingStartedDoc/buildSdkConfig';
import type {
  ContentBlock,
  DocsParams,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getFeedbackConfigOptions} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {getReplayConfigOptions} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';

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

  if (params.isLogsSelected) {
    dynamicParts.push(`
      // Enable logs to be sent to Sentry
      enableLogs: true`);
  }

  return dynamicParts;
};

const getIntegrations = (params: DocsParams): string[] => {
  const integrations = [];

  if (params.isPerformanceSelected) {
    integrations.push('Sentry.browserTracingIntegration()');
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

export function getMainConfigSnippet(params: DocsParams) {
  const config = buildSdkConfig({
    params,
    staticParts: [`dsn: "${params.dsn.public}"`],
    // Main process doesn't need integrations for replay/performance
    getIntegrations: () => [],
    getDynamicParts: p => {
      const parts: string[] = [];
      if (p.isPerformanceSelected) {
        parts.push(`
      // Tracing
      tracesSampleRate: 1.0, //  Capture 100% of the transactions`);
      }
      if (p.isLogsSelected) {
        parts.push(`
      // Enable logs to be sent to Sentry
      enableLogs: true`);
      }
      // Metrics are automatically enabled, no config needed
      return parts;
    },
  });

  return `
import * as Sentry from "@sentry/electron/main";

Sentry.init({
  ${config}
});`;
}

export function getRendererConfigSnippet(params: DocsParams) {
  const config = buildSdkConfig({
    params,
    staticParts: [
      `// Configuration shared between renderer processes`,
      `// The main process manages DSN, release, and environment`,
    ],
    getIntegrations,
    getDynamicParts,
  });

  return `
import * as Sentry from "@sentry/electron/renderer";

Sentry.init({
  ${config}
});`;
}

export const installCodeBlock: ContentBlock = {
  type: 'code',
  tabs: [
    {
      label: 'npm',
      language: 'bash',
      code: 'npm install --save @sentry/electron',
    },
    {
      label: 'yarn',
      language: 'bash',
      code: 'yarn add @sentry/electron',
    },
    {
      label: 'pnpm',
      language: 'bash',
      code: 'pnpm add @sentry/electron',
    },
  ],
};

import {buildSdkConfig} from 'sentry/components/onboarding/gettingStartedDoc/buildSdkConfig';
import type {
  ContentBlock,
  DocsParams,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getFeedbackConfigOptions} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {getReplayConfigOptions} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';

const getDynamicParts = (params: DocsParams): string[] => {
  const dynamicParts: string[] = [];

  if (params.isPerformanceSelected || params.isProfilingSelected) {
    dynamicParts.push(`
      // Tracing
      // Capture 100% of spans. Reduce this value in production.
      tracesSampleRate: 1.0,
      // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
      tracePropagationTargets: ["localhost", /^https:\\/\\/yourserver\\.io\\/api/]`);
  }

  if (params.isReplaySelected) {
    dynamicParts.push(`
      // Session Replay
      // Capture 10% of all sessions, plus 100% of sessions with an error.
      // You may want to capture 100% of sessions while in development.
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0`);
  }

  if (params.isProfilingSelected) {
    dynamicParts.push(`
      // Profiling
      // Profile 100% of sessions while a trace is active.
      // The decision to profile is made once per session, when the SDK is initialized.
      profileSessionSampleRate: 1.0,
      profileLifecycle: "trace"`);
  }

  return dynamicParts;
};

const getIntegrations = (params: DocsParams): string[] => {
  const integrations = [];
  if (params.isPerformanceSelected || params.isProfilingSelected) {
    integrations.push('Sentry.browserTracingIntegration()');
  }

  if (params.isProfilingSelected) {
    integrations.push('Sentry.browserProfilingIntegration()');
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
      })`);
  }

  return integrations;
};

/**
 * The contents of `instrument.js`, which the entry point imports first.
 */
export function getSdkSetupSnippet(params: DocsParams) {
  const config = buildSdkConfig({
    params,
    staticParts: [`dsn: "${params.dsn.public}"`],
    getIntegrations,
    getDynamicParts,
  });

  return `import * as Sentry from "@sentry/react";

Sentry.init({
  ${config}
});
`;
}

export const entryPointSnippet = `// Import Sentry before anything else, so it can capture errors during startup
import "./instrument";
import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App";

const container = document.getElementById("root");
// React 19+ reports errors through these hooks
const root = createRoot(container, {
  // Called when an error is thrown and not caught by an ErrorBoundary
  onUncaughtError: Sentry.reactErrorHandler((error, errorInfo) => {
    console.warn("Uncaught error", error, errorInfo.componentStack);
  }),
  // Called when React catches an error in an ErrorBoundary
  onCaughtError: Sentry.reactErrorHandler(),
  // Called when React automatically recovers from errors
  onRecoverableError: Sentry.reactErrorHandler(),
});
root.render(<App />);
`;

export const errorBoundarySnippet = `import * as Sentry from "@sentry/react";

export default function App() {
  return (
    <Sentry.ErrorBoundary fallback={<p>An error has occurred</p>}>
      <YourAppContent />
    </Sentry.ErrorBoundary>
  );
}
`;

export const installSnippetBlock: ContentBlock = {
  type: 'code',
  tabs: [
    {label: 'npm', language: 'bash', code: 'npm install --save @sentry/react'},
    {label: 'yarn', language: 'bash', code: 'yarn add @sentry/react'},
    {label: 'pnpm', language: 'bash', code: 'pnpm add @sentry/react'},
  ],
};

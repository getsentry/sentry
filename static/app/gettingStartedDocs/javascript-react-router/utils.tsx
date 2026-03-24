import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getFeedbackConfigOptions} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {getReplayConfigOptions} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';

export function getInstallSnippet({isSelfHosted, organization, project}: DocsParams) {
  const urlParam = isSelfHosted ? '' : '--saas';
  return `npx @sentry/wizard@latest -i reactRouter ${urlParam} --org ${organization.slug} --project ${project.slug}`;
}

export function getClientSetupSnippet(params: DocsParams) {
  const logsSnippet = params.isLogsSelected
    ? `
  // Enable logs to be sent to Sentry
  enableLogs: true,`
    : '';

  const performanceSnippet = params.isPerformanceSelected
    ? `
  tracesSampleRate: 1.0, // Capture 100% of the transactions
  // Set \`tracePropagationTargets\` to declare which URL(s) should have trace propagation enabled
  tracePropagationTargets: [/^\\//, /^https:\\/\\/yourserver\\.io\\/api/],`
    : '';

  const replaySnippet = params.isReplaySelected
    ? `
  replaysSessionSampleRate: 0.1, // Capture 10% of all sessions
  replaysOnErrorSampleRate: 1.0, // Capture 100% of sessions with an error`
    : '';

  const integrationsList = [];

  if (params.isPerformanceSelected) {
    integrationsList.push(`
    // Tracing
    Sentry.reactRouterTracingIntegration(),`);
  }

  if (params.isReplaySelected) {
    integrationsList.push(`
    // Session Replay
    Sentry.replayIntegration(${getReplayConfigOptions(params.replayOptions)}),`);
  }

  if (params.isFeedbackSelected) {
    integrationsList.push(`
    // User Feedback
    Sentry.feedbackIntegration({
      // Additional SDK configuration goes in here, for example:
      colorScheme: "system",
      ${getFeedbackConfigOptions(params.feedbackOptions)}
    }),`);
  }

  const integrationsCode =
    integrationsList.length > 0
      ? `
  integrations: [${integrationsList.join('')}
  ],`
      : '';

  return `
import * as Sentry from "@sentry/react-router";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

Sentry.init({
  dsn: "${params.dsn.public}",
  // Adds request headers and IP for users, for more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/react-router/configuration/options/#sendDefaultPii
  sendDefaultPii: true,${integrationsCode}${logsSnippet}${performanceSnippet}${replaySnippet}
});

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>
  );
});`;
}

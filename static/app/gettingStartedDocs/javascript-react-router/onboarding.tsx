import {Fragment} from 'react';

import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

import {getClientSetupSnippet} from './utils';

function getServerSetupSnippet(params: DocsParams) {
  const logsSnippet = params.isLogsSelected
    ? `
  // Enable logs to be sent to Sentry
  enableLogs: true,`
    : '';

  const performanceSnippet = params.isPerformanceSelected
    ? `
  tracesSampleRate: 1.0, // Capture 100% of the transactions`
    : '';

  const profilingSnippet = params.isProfilingSelected
    ? `
  profilesSampleRate: 1.0, // profile every transaction`
    : '';

  const profilingImport = params.isProfilingSelected
    ? `
import { nodeProfilingIntegration } from '@sentry/profiling-node';`
    : '';

  const integrationsList = [];

  if (params.isProfilingSelected) {
    integrationsList.push(`
    // Profiling
    nodeProfilingIntegration(),`);
  }

  const integrationsCode =
    integrationsList.length > 0
      ? `
  integrations: [${integrationsList.join('')}
  ],`
      : '';

  return `
import * as Sentry from "@sentry/react-router";${profilingImport}

Sentry.init({
  dsn: "${params.dsn.public}",
  // Adds request headers and IP for users, for more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/react-router/configuration/options/#sendDefaultPii
  sendDefaultPii: true,${integrationsCode}${logsSnippet}${performanceSnippet}${profilingSnippet}
});`;
}

const getRootErrorBoundarySnippet = () => `
import * as Sentry from "@sentry/react-router";

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (error && error instanceof Error) {
    // you only want to capture non 404-errors that reach the boundary
    Sentry.captureException(error);
    if (import.meta.env.DEV) {
      details = error.message;
      stack = error.stack;
    }
  }

  return (
    <main>
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre>
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}`;

const getServerEntrySnippet = () => `
import * as Sentry from '@sentry/react-router';
import { createReadableStreamFromReadable } from '@react-router/node';
import { renderToPipeableStream } from 'react-dom/server';
import { ServerRouter } from 'react-router';
import { type HandleErrorFunction } from 'react-router';

const handleRequest = Sentry.createSentryHandleRequest({
  ServerRouter,
  renderToPipeableStream,
  createReadableStreamFromReadable,
});

export default handleRequest;

export const handleError: HandleErrorFunction = (error, { request }) => {
  // React Router may abort some interrupted requests, don't log those
  if (!request.signal.aborted) {
    Sentry.captureException(error);
    // optionally log the error to the console so you can see it
    console.error(error);
  }
};`;

const getVerifySnippet = (params: DocsParams) => {
  const logsCode = params.isLogsSelected
    ? `
  // Send a log before throwing the error
  Sentry.logger.info("User triggered test error", {
    'action': 'test_loader_error',
  });`
    : '';
  const metricsCode = params.isMetricsSelected
    ? `
  // Send a test metric before throwing the error
  Sentry.metrics.count('test_counter', 1);`
    : '';
  return `
import type { Route } from "./+types/error-page";

export async function loader() {${logsCode}${metricsCode}
  throw new Error("Sentry Test Error");
}

export default function ErrorPage() {
  return <div>This page will throw an error!</div>;
}`;
};

const getPackageJsonScriptsSnippet = () => `
{
  "scripts": {
    "dev": "NODE_OPTIONS='--import ./instrument.server.mjs' react-router dev",
    "start": "NODE_OPTIONS='--import ./instrument.server.mjs' react-router-serve ./build/server/index.js"
  }
}`;

export const onboarding: OnboardingConfig = {
  introduction: () => (
    <Fragment>
      <p>{t("In this guide you'll set up the Sentry React Router SDK")}</p>
      <p>
        {tct(
          'If you are using React Router in library mode, you can follow the instructions in the [reactLibraryLink:React guide].',
          {
            reactLibraryLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/react/features/react-router/" />
            ),
          }
        )}
      </p>
    </Fragment>
  ),
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Install the Sentry React Router SDK using [code:npm], [code:yarn], or [code:pnpm]:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'npm',
              language: 'bash',
              code: 'npm install @sentry/react-router',
            },
            {
              label: 'yarn',
              language: 'bash',
              code: 'yarn add @sentry/react-router',
            },
            {
              label: 'pnpm',
              language: 'bash',
              code: 'pnpm add @sentry/react-router',
            },
          ],
        },
      ],
    },
  ],
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: t(
            'First, expose the hooks in your app folder by running the reveal command:'
          ),
        },
        {
          type: 'code',
          language: 'bash',
          code: 'npx react-router reveal',
        },
      ],
    },
    {
      title: t('Client Setup'),
      content: [
        {
          type: 'text',
          text: tct(
            'Initialize the Sentry React Router SDK in your [code:entry.client.tsx] file, above where you call [code:hydrateRoot]:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'tsx',
          code: getClientSetupSnippet(params),
        },
      ],
    },
    {
      title: t('Error Boundary'),
      content: [
        {
          type: 'text',
          text: tct(
            'Update your [code:app/root.tsx] file to report any unhandled errors from your error boundary component by adding [code:Sentry.captureException]:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'tsx',
          code: getRootErrorBoundarySnippet(),
        },
      ],
    },
    {
      title: t('Server Setup'),
      content: [
        {
          type: 'text',
          text: tct(
            'Create an [code:instrument.server.mjs] file in the root of your app:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'js',
          code: getServerSetupSnippet(params),
        },
        {
          type: 'text',
          text: tct('Update your [code:entry.server.tsx] file:', {code: <code />}),
        },
        {
          type: 'code',
          language: 'tsx',
          code: getServerEntrySnippet(),
        },
      ],
    },
    {
      title: t('Update Scripts'),
      content: [
        {
          type: 'text',
          text: t(
            'Update your package.json scripts to include the server instrumentation:'
          ),
        },
        {
          type: 'code',
          language: 'json',
          code: getPackageJsonScriptsSnippet(),
        },
      ],
    },
    {
      title: t('Upload Source Maps (Optional)'),
      content: [
        {
          type: 'text',
          text: tct(
            'To upload source maps to Sentry, follow the [link:instructions in our documentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/react-router/#source-maps-upload" />
              ),
            }
          ),
        },
      ],
      collapsible: true,
    },
  ],
  verify: params => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Create a route that throws an error to verify that Sentry is working. After opening this route in your browser, you should see the error in your Sentry issue stream.'
          ),
        },
        {
          type: 'code',
          language: 'tsx',
          code: getVerifySnippet(params),
        },
      ],
    },
  ],
};

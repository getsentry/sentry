import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportJavaScriptInstallStep,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
  getFeedbackConfigOptions,
  getFeedbackConfigureDescription,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {
  getProfilingDocumentHeaderConfigurationStep,
  MaybeBrowserProfilingBetaWarning,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/profilingOnboarding';
import {
  getReplayConfigOptions,
  getReplayConfigureDescription,
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {t, tct} from 'sentry/locale';
import {getJavascriptProfilingOnboarding} from 'sentry/utils/gettingStartedDocs/javascript';

type Params = DocsParams;

const getClientSetupSnippet = (params: Params) => `
import * as Sentry from "@sentry/react-router";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

Sentry.init({
  dsn: "${params.dsn.public}",

  // Adds request headers and IP for users, for more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/react-router/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  integrations: [${
    params.isPerformanceSelected
      ? `
    // Performance
    Sentry.reactRouterTracingIntegration(),`
      : ''
  }${
    params.isReplaySelected
      ? `
    // Session Replay
    Sentry.replayIntegration(${getReplayConfigOptions(params.replayOptions)}),`
      : ''
  }${
    params.isFeedbackSelected
      ? `
    // User Feedback
    Sentry.feedbackIntegration({
      // Additional SDK configuration goes in here, for example:
      colorScheme: "system",
      ${getFeedbackConfigOptions(params.feedbackOptions)}
    }),`
      : ''
  }
  ],${
    params.isPerformanceSelected
      ? `

  tracesSampleRate: 1.0, // Capture 100% of the transactions

  // Set \`tracePropagationTargets\` to declare which URL(s) should have trace propagation enabled
  tracePropagationTargets: [/^\\//, /^https:\\/\\/yourserver\\.io\\/api/],`
      : ''
  }${
    params.isReplaySelected
      ? `

  // Capture Replay for 10% of all sessions,
  // plus 100% of sessions with an error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,`
      : ''
  }
});

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>
  );
});`;

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

const getServerSetupSnippet = (params: Params) => `
import * as Sentry from "@sentry/react-router";${
  params.isProfilingSelected
    ? `
import { nodeProfilingIntegration } from '@sentry/profiling-node';`
    : ''
}

Sentry.init({
  dsn: "${params.dsn.public}",

  // Adds request headers and IP for users, for more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/react-router/configuration/options/#sendDefaultPii
  sendDefaultPii: true,${
    params.isProfilingSelected
      ? `

  integrations: [nodeProfilingIntegration()],`
      : ''
  }${
    params.isPerformanceSelected
      ? `
  tracesSampleRate: 1.0, // Capture 100% of the transactions`
      : ''
  }${
    params.isProfilingSelected
      ? `
  profilesSampleRate: 1.0, // profile every transaction`
      : ''
  }
});`;

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
    // optionally log the error so you can see it
    console.error(error);
  }
};`;

const getVerifySnippet = () => `
import type { Route } from "./+types/error-page";

export async function loader() {
  throw new Error("Sentry Test Error");
}

export default function ErrorPage() {
  return <div>This page will throw an error!</div>;
}`;

const getInstallConfig = () => [
  {
    language: 'bash',
    code: [
      {
        label: 'npm',
        value: 'npm',
        language: 'bash',
        code: 'npm install @sentry/react-router',
      },
      {
        label: 'yarn',
        value: 'yarn',
        language: 'bash',
        code: 'yarn add @sentry/react-router',
      },
      {
        label: 'pnpm',
        value: 'pnpm',
        language: 'bash',
        code: 'pnpm add @sentry/react-router',
      },
    ],
  },
];

const getInstallConfigWithProfiling = () => [
  {
    language: 'bash',
    code: [
      {
        label: 'npm',
        value: 'npm',
        language: 'bash',
        code: 'npm install @sentry/react-router @sentry/profiling-node',
      },
      {
        label: 'yarn',
        value: 'yarn',
        language: 'bash',
        code: 'yarn add @sentry/react-router @sentry/profiling-node',
      },
      {
        label: 'pnpm',
        value: 'pnpm',
        language: 'bash',
        code: 'pnpm add @sentry/react-router @sentry/profiling-node',
      },
    ],
  },
];

const onboarding: OnboardingConfig = {
  introduction: params => (
    <Fragment>
      <MaybeBrowserProfilingBetaWarning {...params} />
      <p>
        {tct(
          'React Router v7 is a framework for building full-stack web apps and websites. This SDK is considered [strong:experimental and in an alpha state]. It may experience breaking changes.',
          {
            strong: <strong />,
          }
        )}
      </p>
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
  install: params => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Install the Sentry React Router SDK using [code:npm], [code:yarn], or [code:pnpm]:',
        {code: <code />}
      ),
      configurations: params.isProfilingSelected
        ? getInstallConfigWithProfiling()
        : getInstallConfig(),
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: t(
        'First, expose the hooks in your app folder by running the reveal command:'
      ),
      language: 'bash',
      code: 'npx react-router reveal',
    },
    {
      type: StepType.CONFIGURE,
      description: tct(
        'Initialize the Sentry React SDK in your [code:entry.client.tsx] file:',
        {code: <code />}
      ),
      configurations: [
        {
          language: 'tsx',
          code: getClientSetupSnippet(params),
        },
      ],
    },
    {
      type: StepType.CONFIGURE,
      description: tct(
        'Update your [code:app/root.tsx] file to report any unhandled errors from your error boundary:',
        {code: <code />}
      ),
      configurations: [
        {
          language: 'tsx',
          code: getRootErrorBoundarySnippet(),
        },
      ],
    },
    {
      type: StepType.CONFIGURE,
      description: tct(
        'Create an [code:instrument.server.mjs] file in the root of your app:',
        {code: <code />}
      ),
      configurations: [
        {
          language: 'js',
          code: getServerSetupSnippet(params),
        },
      ],
    },
    {
      type: StepType.CONFIGURE,
      description: tct(
        'Update your [code:entry.server.tsx] file:',
        {code: <code />}
      ),
      configurations: [
        {
          language: 'tsx',
          code: getServerEntrySnippet(),
        },
      ],
    },
    {
      type: StepType.CONFIGURE,
      description: t(
        'Update your package.json scripts to include the server instrumentation:'
      ),
      language: 'json',
      code: `{
  "scripts": {
    "dev": "NODE_OPTIONS='--import ./instrument.server.mjs' react-router dev",
    "start": "NODE_OPTIONS='--import ./instrument.server.mjs' react-router-serve ./build/server/index.js"
  }
}`,
    },
    ...(params.isProfilingSelected
      ? [getProfilingDocumentHeaderConfigurationStep()]
      : []),
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t(
        'Create a route that throws an error to verify that Sentry is working. After opening this route in your browser, you should see the error in your Sentry issue stream.'
      ),
      configurations: [
        {
          language: 'tsx',
          code: getVerifySnippet(),
        },
      ],
    },
  ],
  nextSteps: () => [
    {
      id: 'react-router-features',
      name: t('React Router Features'),
      description: t('Learn about the React Router specific features of Sentry.'),
      link: 'https://docs.sentry.io/platforms/javascript/guides/react-router/',
    },
    {
      id: 'performance-monitoring',
      name: t('Performance Monitoring'),
      description: t(
        'Track down transactions to see what transactions are slow.'
      ),
      link: 'https://docs.sentry.io/platforms/javascript/guides/react-router/tracing/',
    },
    {
      id: 'session-replay',
      name: t('Session Replay'),
      description: t(
        'Get to the root cause of an error or latency issue faster by seeing all the technical details related to that issue in one visual replay on your web application.'
      ),
      link: 'https://docs.sentry.io/platforms/javascript/guides/react-router/session-replay/',
    },
  ],
};

const replayOnboarding: OnboardingConfig = {
  install: () => onboarding.install(),
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: getReplayConfigureDescription({
        link: 'https://docs.sentry.io/platforms/javascript/guides/react-router/session-replay/',
      }),
      configurations: [
        {
          language: 'tsx',
          code: getClientSetupSnippet(params),
        },
      ],
    },
  ],
  verify: getReplayVerifyStep(),
  nextSteps: () => [],
};

const feedbackOnboarding: OnboardingConfig = {
  install: () => onboarding.install(),
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: getFeedbackConfigureDescription({
        linkConfig:
          'https://docs.sentry.io/platforms/javascript/guides/react-router/user-feedback/configuration/',
        linkButton:
          'https://docs.sentry.io/platforms/javascript/guides/react-router/user-feedback/configuration/#bring-your-own-button',
      }),
      configurations: [
        {
          language: 'tsx',
          code: getClientSetupSnippet(params),
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportJavaScriptInstallStep(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getCrashReportModalConfigDescription({
        link: 'https://docs.sentry.io/platforms/javascript/guides/react-router/user-feedback/configuration/#crash-report-modal',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const performanceOnboarding: OnboardingConfig = {
  introduction: () =>
    t(
      'Adding Performance to your React Router project is simple. Make sure you have these basics down.'
    ),
  install: onboarding.install,
  configure: params => [
    {
      type: StepType.CONFIGURE,
      configurations: [
        {
          description: t(
            'Configuration should happen as early as possible in your application\'s lifecycle.'
          ),
          language: 'tsx',
          code: getClientSetupSnippet(params),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t(
        'Create a route that throws an error to verify performance monitoring is working.'
      ),
      configurations: [
        {
          language: 'tsx',
          code: getVerifySnippet(),
        },
      ],
    },
  ],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  replayOnboardingNpm: replayOnboarding,
  feedbackOnboardingNpm: feedbackOnboarding,
  crashReportOnboarding,
  performanceOnboarding,
  profilingOnboarding: getJavascriptProfilingOnboarding({
    packageName: '@sentry/react-router',
  }),
};

export default docs;

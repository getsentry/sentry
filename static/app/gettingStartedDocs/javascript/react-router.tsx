import {Fragment} from 'react';

import {ExternalLink} from 'sentry/components/core/link';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
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
import {getJavascriptFullStackOnboarding} from 'sentry/utils/gettingStartedDocs/javascript';
import {getNodeAgentMonitoringOnboarding} from 'sentry/utils/gettingStartedDocs/node';

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

const getPackageJsonScriptsSnippet = () => `
{
  "scripts": {
    "dev": "NODE_OPTIONS='--import ./instrument.server.mjs' react-router dev",
    "start": "NODE_OPTIONS='--import ./instrument.server.mjs' react-router-serve ./build/server/index.js"
  }
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
      configurations: [
        {
          language: 'bash',
          code: 'npx react-router reveal',
        },
      ],
    },
    {
      description: tct(
        'Initialize the Sentry React Router SDK in your [code:entry.client.tsx] file:',
        {code: <code />}
      ),
      title: t('Client Setup'),
      configurations: [
        {
          language: 'tsx',
          code: getClientSetupSnippet(params),
        },
      ],
    },
    {
      description: tct(
        'Update your [code:app/root.tsx] file to report any unhandled errors from your error boundary component by adding [code:Sentry.captureException]:',
        {code: <code />}
      ),
      title: t('Error Boundary'),
      configurations: [
        {
          language: 'tsx',
          code: getRootErrorBoundarySnippet(),
        },
      ],
    },
    {
      title: t('Server Setup'),
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
      title: '',
      description: tct('Update your [code:entry.server.tsx] file:', {code: <code />}),
      configurations: [
        {
          language: 'tsx',
          code: getServerEntrySnippet(),
        },
      ],
    },
    {
      title: t('Update Scripts'),
      description: t(
        'Update your package.json scripts to include the server instrumentation:'
      ),
      configurations: [
        {
          language: 'json',
          code: getPackageJsonScriptsSnippet(),
        },
      ],
    },
    {
      title: t('Upload Source Maps (Optional)'),
      description: tct(
        'To upload source maps to Sentry, follow the [link:instructions in our documentation].',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/react-router/#source-maps-upload" />
          ),
        }
      ),
      collapsible: true,
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
};

const replayOnboarding: OnboardingConfig = {
  install: (params: Params) => onboarding.install(params),
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
  install: (params: Params) => onboarding.install(params),
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
            "Configuration should happen as early as possible in your application's lifecycle."
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
      description: tct(
        'Verify that performance monitoring is working correctly with our [link:automatic instrumentation] by simply using your React Router application.',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/react-router/tracing/instrumentation/automatic-instrumentation/" />
          ),
        }
      ),
    },
  ],
  nextSteps: () => [],
};

const profilingOnboarding = getJavascriptFullStackOnboarding({
  basePackage: '@sentry/react-router',
  browserProfilingLink:
    'https://docs.sentry.io/platforms/javascript/guides/react-router/profiling/browser-profiling/',
  nodeProfilingLink:
    'https://docs.sentry.io/platforms/javascript/guides/react-router/profiling/node-profiling/',
});

const docs: Docs = {
  onboarding,
  replayOnboarding,
  feedbackOnboardingNpm: feedbackOnboarding,
  crashReportOnboarding,
  performanceOnboarding,
  profilingOnboarding,
  agentMonitoringOnboarding: getNodeAgentMonitoringOnboarding({
    basePackage: 'react-router',
  }),
};

export default docs;

import {Fragment} from 'react';

import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {MaybeBrowserProfilingBetaWarning} from 'sentry/components/onboarding/gettingStartedDoc/utils/profilingOnboarding';
import {t, tct} from 'sentry/locale';
import {getJavascriptFullStackOnboarding} from 'sentry/utils/gettingStartedDocs/javascript';
import {getNodeAgentMonitoringOnboarding} from 'sentry/utils/gettingStartedDocs/node';

type Params = DocsParams;

const getInstallConfig = () => [
  {
    language: 'bash',
    code: [
      {
        label: 'npm',
        value: 'npm',
        language: 'bash',
        code: 'npm install --save @sentry/tanstackstart-react',
      },
      {
        label: 'yarn',
        value: 'yarn',
        language: 'bash',
        code: 'yarn add @sentry/tanstackstart-react',
      },
      {
        label: 'pnpm',
        value: 'pnpm',
        language: 'bash',
        code: 'pnpm add @sentry/tanstackstart-react',
      },
    ],
  },
];

const onboarding: OnboardingConfig = {
  introduction: params => (
    <Fragment>
      <MaybeBrowserProfilingBetaWarning {...params} />
      <p>{t("In this guide you'll set up the Sentry TanStack Start React SDK")}</p>
    </Fragment>
  ),
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Add the Sentry TanStack Start SDK as a dependency using [code:npm], [code:yarn] or [code:pnpm]:',
        {code: <code />}
      ),
      configurations: getInstallConfig(),
    },
  ],
  configure: (params: Params) => [
    {
      title: t('Set up the SDK'),
      description: t(
        'In the following steps we will set up the SDK and instrument various parts of your application.'
      ),
      configurations: [
        {
          description: tct(
            "First, extend your app's default TanStack Start configuration by adding [code:wrapVinxiConfigWithSentry] to your [code:app.config.ts] file:",
            {code: <code />}
          ),
          code: [
            {
              label: 'TypeScript',
              value: 'typescript',
              language: 'typescript',
              filename: 'app.config.ts',
              code: `import { defineConfig } from "@tanstack/react-start/config";
import { wrapVinxiConfigWithSentry } from "@sentry/tanstackstart-react";

const config = defineConfig({
    // ... your other TanStack Start config
})

export default wrapVinxiConfigWithSentry(config, {
  org: "${params.organization.slug}",
  project: "${params.projectSlug}",
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only print logs for uploading source maps in CI
  // Set to \`true\` to suppress logs
  silent: !process.env.CI,
});
`,
            },
          ],
        },
        {
          description: tct(
            'In future versions of this SDK, setting the [code:SENTRY_AUTH_TOKEN] environment variable during your build will upload sourcemaps for you to see unminified errors in Sentry.',
            {code: <code />}
          ),
          code: [
            {
              value: 'bash',
              language: 'bash',
              label: 'Bash',
              code: `SENTRY_AUTH_TOKEN=___ORG_AUTH_TOKEN___`,
            },
          ],
        },
        {
          description: tct(
            'Add the following initialization code to your [code:app/client.tsx] file to initialize Sentry on the client:',
            {code: <code />}
          ),
          code: [
            {
              label: 'tsx',
              value: 'tsx',
              language: 'tsx',
              filename: 'app/client.tsx',
              code: `import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start";
import { createRouter } from "./router";

import * as Sentry from "@sentry/tanstackstart-react";

const router = createRouter();

Sentry.init({
  dsn: "${params.dsn.public}",${
    params.isPerformanceSelected || params.isReplaySelected
      ? `
  integrations: [${
    params.isPerformanceSelected
      ? `
    Sentry.tanstackRouterBrowserTracingIntegration(router),`
      : ''
  }${
    params.isReplaySelected
      ? `
    Sentry.replayIntegration(),`
      : ''
  }
  ],`
      : ''
  }${
    params.isPerformanceSelected
      ? `

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for tracing.
  tracesSampleRate: 1.0,`
      : ''
  }${
    params.isReplaySelected
      ? `

  // Capture Replay for 10% of all sessions,
  // plus for 100% of sessions with an error.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,`
      : ''
  }

  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});

hydrateRoot(document, <StartClient router={router} />);`,
            },
          ],
        },
        {
          description: tct(
            'Add the following initialization code anywhere in your [code:app/ssr.tsx] file to initialize Sentry on the server:',
            {code: <code />}
          ),
          code: [
            {
              label: 'tsx',
              value: 'tsx',
              language: 'tsx',
              filename: 'app/ssr.tsx',
              code: `import * as Sentry from "@sentry/tanstackstart-react";

Sentry.init({
  dsn: "${params.dsn.public}",${
    params.isPerformanceSelected
      ? `

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for tracing.
  // We recommend adjusting this value in production
  // Learn more at
  // https://docs.sentry.io/platforms/javascript/configuration/options/#traces-sample-rate
  tracesSampleRate: 1.0,`
      : ''
  }

  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});`,
            },
          ],
        },
        {
          description: tct(
            "Wrap TanStack Start's [code:createRootRoute] function using [code:wrapCreateRootRouteWithSentry] to apply tracing to Server-Side Rendering (SSR):",
            {code: <code />}
          ),
          code: [
            {
              label: 'tsx',
              value: 'tsx',
              language: 'tsx',
              filename: 'app/routes/__root.tsx',
              code: `import type { ReactNode } from "react";
import { createRootRoute } from "@tanstack/react-router";

// (Wrap \`createRootRoute\`, not its return value!)
export const Route = wrapCreateRootRouteWithSentry(createRootRoute)({
  // ...
});`,
            },
          ],
        },
        {
          description: tct(
            "Wrap TanStack Start's [code:defaultStreamHandler] function using [code:wrapStreamHandlerWithSentry] to instrument requests to your server:",
            {code: <code />}
          ),
          code: [
            {
              label: 'tsx',
              value: 'tsx',
              language: 'tsx',
              filename: 'app/ssr.tsx',
              code: `import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";
import { getRouterManifest } from "@tanstack/react-start/router-manifest";
import { createRouter } from "./router";
import * as Sentry from "@sentry/tanstackstart-react";

export default createStartHandler({
  createRouter,
  getRouterManifest,
})(Sentry.wrapStreamHandlerWithSentry(defaultStreamHandler));`,
            },
          ],
        },
        {
          description: tct(
            "Add the [code:sentryGlobalServerMiddlewareHandler] to your global middlewares to instrument your server function invocations. If you haven't done so, create a [code:app/global-middleware.ts] file.",
            {code: <code />}
          ),
          code: [
            {
              label: 'TypeScript',
              value: 'typescript',
              language: 'typescript',
              filename: 'app/global-middleware.ts',
              code: `import {
  createMiddleware,
  registerGlobalMiddleware,
} from "@tanstack/react-start";
import * as Sentry from "@sentry/tanstackstart-react";

registerGlobalMiddleware({
  middleware: [
    createMiddleware().server(Sentry.sentryGlobalServerMiddlewareHandler()),
  ],
});`,
            },
          ],
        },
        {
          description: t(
            'The Sentry SDK cannot capture errors that you manually caught yourself with error boundaries.'
          ),
        },
        {
          description: tct(
            'If you have React error boundaries in your app and you want to report errors that these boundaries catch to Sentry, apply the [code:withErrorBoundary] wrapper to your [code:ErrorBoundary]:',
            {code: <code />}
          ),
          code: [
            {
              label: 'tsx',
              value: 'tsx',
              language: 'tsx',
              code: `import React from "react";
import * as Sentry from "@sentry/tanstackstart-react";

class MyErrorBoundary extends React.Component {
  // ...
}

export const MySentryWrappedErrorBoundary = withErrorBoundary(
  MyErrorBoundary,
  {
    // ... sentry error wrapper options
  },
);`,
            },
          ],
        },
        {
          description: tct(
            'If you defined [code:errorComponents] in your Code-Based TanStack Router routes, capture the [code:error] argument with [code:captureException] inside a [code:useEffect] hook:',
            {code: <code />}
          ),
          code: [
            {
              label: 'tsx',
              value: 'tsx',
              language: 'tsx',
              code: `import { createRoute } from "@tanstack/react-router";
import * as Sentry from "@sentry/tanstackstart-react";

const route = createRoute({
  errorComponent: ({ error }) => {
    useEffect(() => {
      Sentry.captureException(error)
    }, [error])

    return (
      // ...
    )
  }
})`,
            },
          ],
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t(
        "Let's test your setup and confirm that Sentry is working correctly and sending data to your Sentry project."
      ),
      configurations: [
        {
          description: t(
            'To verify that Sentry captures errors and creates issues in your Sentry project, add a test button to an existing page or create a new one:'
          ),
          code: [
            {
              label: 'tsx',
              value: 'tsx',
              language: 'tsx',
              code: `<button
  type="button"
  onClick={() => {
    throw new Error("Sentry Test Error");
  }}
>
  Break the world
</button>
`,
            },
          ],
        },
        {
          description: tct(
            'To test tracing, create a test API route like /api/sentry-example-api:',
            {code: <code />}
          ),
          code: [
            {
              label: 'TypeScript',
              value: 'typescript',
              language: 'typescript',
              filename: 'app/routes/api/sentry-example-api.ts',
              code: `import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";

// A faulty API route to test Sentry's error monitoring
export const APIRoute = createAPIFileRoute("/api/sentry-example-api")({
  GET: ({ request, params }) => {
    throw new Error("Sentry Example API Route Error");
    return json({ message: "Testing Sentry Error..." });
  },
});`,
            },
          ],
        },
        {
          description: tct(
            "Next, update your test button to call this route and throw an error if the response isn't [code:ok]:",
            {code: <code />}
          ),
          code: [
            {
              label: 'tsx',
              value: 'tsx',
              language: 'tsx',
              code: `<button
  type="button"
  onClick={async () => {
    await Sentry.startSpan(
      {
        name: "Example Frontend Span",
        op: "test",
      },
      async () => {
        const res = await fetch("/api/sentry-example-api");
        if (!res.ok) {
          throw new Error("Sentry Example Frontend Error");
        }
      },
    );
  }}
>
  Break the world
</button>`,
            },
          ],
          additionalInfo: (
            <Fragment>
              <p>
                Open the page in a browser and click the button to trigger two errors:
              </p>
              <ul>
                <li>a frontend error</li>
                <li>an error within the API route</li>
              </ul>
              <p>
                Additionally, this starts a performance trace to measure the time it takes
                for the API request to complete.
              </p>
            </Fragment>
          ),
        },
      ],
    },
  ],
};

const profilingOnboarding = getJavascriptFullStackOnboarding({
  basePackage: '@sentry/tanstackstart-react',
  browserProfilingLink:
    'https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/profiling/browser-profiling/',
  nodeProfilingLink:
    'https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/profiling/node-profiling/',
});

const docs: Docs = {
  onboarding,
  profilingOnboarding,
  agentMonitoringOnboarding: getNodeAgentMonitoringOnboarding({
    basePackage: 'tanstackstart-react',
  }),
};

export default docs;

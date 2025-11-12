import {ExternalLink} from 'sentry/components/core/link';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

export const onboarding: OnboardingConfig = {
  introduction: () =>
    t("In this guide you'll set up the Sentry TanStack Start React SDK"),
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Add the Sentry TanStack Start SDK as a dependency using [code:npm], [code:yarn] or [code:pnpm]:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'npm',
              language: 'bash',
              code: 'npm install --save @sentry/tanstackstart-react',
            },
            {
              label: 'yarn',
              language: 'bash',
              code: 'yarn add @sentry/tanstackstart-react',
            },
            {
              label: 'pnpm',
              language: 'bash',
              code: 'pnpm add @sentry/tanstackstart-react',
            },
          ],
        },
      ],
    },
  ],
  configure: params => [
    {
      title: t('Set up the SDK'),
      content: [
        {
          type: 'text',
          text: t(
            'In the following steps we will set up the SDK and instrument various parts of your application.'
          ),
        },
        {
          type: 'text',
          text: tct(
            'First, initialize Sentry on the client in your [code:src/router.tsx] file:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'TypeScript',
              language: 'typescript',
              filename: 'src/router.tsx',
              code: `import * as Sentry from "@sentry/tanstackstart-react";
import { createRouter } from '@tanstack/react-router'

// Create a new router instance
export const getRouter = () => {
  const router = createRouter();

  if (!router.isServer) {
    Sentry.init({
      dsn: "${params.dsn.public}",

      // Adds request headers and IP for users, for more info visit:
      // https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/configuration/options/#sendDefaultPii
      sendDefaultPii: true,${
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
      // We recommend adjusting this value in production.
      // Learn more at https://docs.sentry.io/platforms/javascript/configuration/options/#traces-sample-rate
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
    });
  }

  return router;
}`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'Create an instrument file [code:instrument.server.mjs] in the root your project. In this file, initialize the Sentry SDK for your server:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'TypeScript',
              language: 'tsx',
              filename: 'instrument.server.mjs',
              code: `import * as Sentry from "@sentry/tanstackstart-react";

Sentry.init({
  dsn: "${params.dsn.public}",

  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,${
    params.isPerformanceSelected
      ? `

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for tracing.
  // We recommend adjusting this value in production.
  // Learn more at https://docs.sentry.io/platforms/javascript/configuration/options/#traces-sample-rate
  tracesSampleRate: 1.0,`
      : ''
  }
});`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'For production monitoring, you need to move the Sentry server config file to your build output. Since [hostingLink:TanStack Start is designed to work with any hosting provider], the exact location will depend on where your build artifacts are deployed (for example, [code:/dist], [code:.output/server] or a platform-specific directory).',
            {
              code: <code />,
              hostingLink: (
                <ExternalLink href="https://tanstack.com/start/latest/docs/framework/react/guide/hosting" />
              ),
            }
          ),
        },
        {
          type: 'text',
          text: tct(
            'For example, when using [nitroLink:Nitro], copy the instrumentation file to [code:.output/server]:',
            {
              code: <code />,
              nitroLink: <ExternalLink href="https://nitro.build/" />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JSON',
              language: 'json',
              filename: 'package.json',
              code: `{
  "scripts": {
     "build": "vite build && cp instrument.server.mjs .output/server",
  }
}`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'Add a [code:--import] flag directly or to the [code:NODE_OPTIONS] environment variable wherever you run your application to import [code:instrument.server.mjs]:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JSON',
              language: 'json',
              filename: 'package.json',
              code: `{
  "scripts": {
     "build": "vite build && cp instrument.server.mjs .output/server",
     "dev": "NODE_OPTIONS='--import ./instrument.server.mjs' vite dev --port 3000",
     "start": "node --import ./.output/server/instrument.server.mjs .output/server/index.mjs",
  }
}`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'Sentry automatically captures unhandled client-side errors. On the server side of TanStack Start, automatic error monitoring is not yet supported. Use [code:captureException] to manually capture errors in your server-side code.',
            {code: <code />}
          ),
        },
        {
          type: 'text',
          text: tct(
            "Errors caught by your own error boundaries aren't captured unless you report them manually. Wrap your custom [code:ErrorBoundary] component with [code:withErrorBoundary]:",
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'TypeScript',
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
          type: 'text',
          text: tct(
            'If you defined [code:errorComponents] in your Code-Based TanStack Router routes, capture the [code:error] argument with [code:captureException] inside a [code:useEffect] hook:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'TypeScript',
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
        {
          type: 'text',
          text: tct(
            'You can prevent ad blockers from blocking Sentry events using tunneling. Use the [code:tunnel] option to add an API endpoint in your application that forwards Sentry events to Sentry servers.',
            {code: <code />}
          ),
        },
        {
          type: 'text',
          text: tct(
            'To enable tunneling, update [code:Sentry.init] with the following option:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'TypeScript',
              language: 'tsx',
              code: `Sentry.init({
  dsn: "${params.dsn.public}",
  tunnel: '/tunnel',
});`,
            },
          ],
        },
      ],
    },
  ],
  verify: params => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            "Let's test your setup and confirm that Sentry is working correctly and sending data to your Sentry project."
          ),
        },
        {
          type: 'text',
          text: t(
            'To verify that Sentry captures errors and creates issues in your Sentry project, add a test button to one of your pages, which will trigger an error that Sentry will capture when you click it:'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'TypeScript',
              language: 'tsx',
              code: `<button
  type="button"
  onClick={() => {${
    params.isMetricsSelected
      ? `
    // Send a test metric before throwing the error
    Sentry.metrics.count('test_counter', 1);`
      : ''
  }
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
          type: 'conditional',
          condition: params.isPerformanceSelected,
          content: [
            {
              type: 'text',
              text: tct(
                'To test tracing, create a new file like [code:src/routes/api/sentry-example.ts] to create a test route [code:/api/sentry-example]:',
                {code: <code />}
              ),
            },
            {
              type: 'code',
              tabs: [
                {
                  label: 'TypeScript',
                  language: 'typescript',
                  filename: 'src/app/routes/api/sentry-example-api.ts',
                  code: `import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";

export const Route = createFileRoute("/api/sentry-example")({
  server: {
    handlers: {
      GET: () => {
        throw new Error("Sentry Example Route Error");
        return new Response(
          JSON.stringify({ message: "Testing Sentry Error..." }),
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      },
    },
  },
});`,
                },
              ],
            },
            {
              type: 'text',
              text: tct(
                "Next, update your test button to call this route and throw an error if the response isn't [code:ok]:",
                {code: <code />}
              ),
            },
            {
              type: 'code',
              tabs: [
                {
                  label: 'TypeScript',
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
        const res = await fetch("/api/sentry-example");
        if (!res.ok) {
          throw new Error("Sentry Example Frontend Error");
        }
      },
    );
  }}
>
  Break the world
</button>;`,
                },
              ],
            },
            {
              type: 'text',
              text: t(
                'Open the page in a browser and click the button to trigger two errors:'
              ),
            },
            {
              type: 'custom',
              content: (
                <ul>
                  <li>{t('a frontend error')}</li>
                  <li>{t('an error within the API route')}</li>
                </ul>
              ),
            },
            {
              type: 'text',
              text: t(
                'Additionally, this starts a performance trace to measure the time it takes for the API request to complete.'
              ),
            },
          ],
        },
        {
          type: 'conditional',
          condition: !params.isPerformanceSelected,
          content: [
            {
              type: 'text',
              text: t(
                'Open the page in a browser and click the button to trigger a frontend error.'
              ),
            },
          ],
        },
        {
          type: 'text',
          text: t(
            'Now view the collected data in your issues feed (it takes a couple of moments for the data to appear).'
          ),
        },
      ],
    },
  ],
};

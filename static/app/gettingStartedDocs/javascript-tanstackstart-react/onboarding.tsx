import {ExternalLink} from '@sentry/scraps/link';

import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getDataCollectionStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
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
            'First, create an [code:instrument.client.ts] file in your [code:src] directory and initialize Sentry in it:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'TypeScript',
              language: 'typescript',
              filename: 'src/instrument.client.ts',
              code: `import * as Sentry from "@sentry/tanstackstart-react";

Sentry.init({
  dsn: "${params.dsn.public}",
${
  params.isReplaySelected
    ? `

  integrations: [
    Sentry.replayIntegration(),
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
});`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'Then import this file as the first import in your [clientEntryLink:client entry point] [code:src/client.tsx]. This ensures Sentry initializes before any other code runs, so errors and events before hydration are captured:',
            {
              code: <code />,
              clientEntryLink: (
                <ExternalLink href="https://tanstack.com/start/latest/docs/framework/react/guide/client-entry-point" />
              ),
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'TypeScript',
              language: 'tsx',
              filename: 'src/client.tsx',
              code: `// Sentry initialization should be imported first!
import "./instrument.client";

import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>
  );
});`,
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
                'Add the TanStack Router browser tracing integration in your [code:src/router.tsx] file:',
                {code: <code />}
              ),
            },
            {
              type: 'code',
              tabs: [
                {
                  label: 'TypeScript',
                  language: 'tsx',
                  filename: 'src/router.tsx',
                  code: `import * as Sentry from "@sentry/tanstackstart-react";
import { createRouter } from '@tanstack/react-router'

// Create a new router instance
export const getRouter = () => {
  const router = createRouter();

  if (!router.isServer) {
    Sentry.addIntegration(
      Sentry.tanstackRouterBrowserTracingIntegration(router)
    );
  }

  return router;
}`,
                },
              ],
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
${
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
            'To capture server-side errors and traces, explicitly define a [serverEntryLink:server entry point] in your application and wrap your request handler with [code:wrapFetchWithSentry].',
            {
              code: <code />,
              serverEntryLink: (
                <ExternalLink href="https://tanstack.com/start/latest/docs/framework/react/guide/server-entry-point" />
              ),
            }
          ),
        },
        {
          type: 'text',
          text: tct(
            "Create a [code:src/server.ts] file in your project. Pass [code:opts] on to the handler, so the request context that TanStack Start passes to it isn't lost:",
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'TypeScript',
              language: 'typescript',
              filename: 'src/server.ts',
              code: `import { wrapFetchWithSentry } from "@sentry/tanstackstart-react";
import handler, {
  createServerEntry,
} from "@tanstack/react-start/server-entry";
import type { ServerEntry } from "@tanstack/react-start/server-entry";

const requestHandler: ServerEntry = wrapFetchWithSentry({
  fetch(request, opts) {
    return handler.fetch(request, opts);
  },
});

export default createServerEntry(requestHandler);`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'Add the [code:sentryTanstackStart] Vite plugin to your [configFile:vite.config.ts] file:',
            {code: <code />, configFile: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'TypeScript',
              language: 'typescript',
              filename: 'vite.config.ts',
              code: `import { defineConfig } from "vite";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default defineConfig({
  plugins: [
    tanstackStart(),
    // other plugins - sentryTanstackStart should be last
    sentryTanstackStart({
      org: "${params.organization.slug}",
      project: "${params.project.slug}",
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
});`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            "If your app builds with [nitroLink:Nitro] for a Node.js runtime, the [code:sentryTanstackStart] Vite plugin (since version 11.13.0) bundles [code:instrument.server.mjs] into the server build and loads it when the server starts. You start your production build as usual, without the [code:--import] flag.",
            {code: <code />, nitroLink: <ExternalLink href="https://nitro.build/" />}
          ),
        },
        {
          type: 'text',
          text: tct(
            "[code:vite dev] doesn't create a server build, so in development, load the file with the [code:--import] flag in the [code:NODE_OPTIONS] environment variable:",
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
     "build": "vite build",
     "dev": "NODE_OPTIONS='--import ./instrument.server.mjs' vite dev --port 3000",
     "start": "node .output/server/index.mjs",
  }
}`,
            },
          ],
        },
        {
          type: 'alert',
          alertType: 'info',
          showIcon: true,
          text: tct(
            "If you deploy to Node.js without Nitro, or to Cloudflare, the plugin doesn't load the server config for you. Follow the [link:TanStack Start React guide] for these setups.",
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/manual-setup/#load-the-server-config-when-the-server-starts" />
              ),
            }
          ),
        },
        {
          type: 'text',
          text: tct(
            "To capture server-side errors from HTTP requests and server function invocations, add Sentry's global middlewares to [code:createStart()] in your [code:src/start.ts] file. A custom [code:src/start.ts] turns off the CSRF protection that TanStack Start adds to server functions by default, so the snippet adds it back with [code:createCsrfMiddleware]:",
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'TypeScript',
              language: 'typescript',
              filename: 'src/start.ts',
              code: `import {
  sentryGlobalFunctionMiddleware,
  sentryGlobalRequestMiddleware,
} from "@sentry/tanstackstart-react";
import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

// Assign the middleware to a variable. Sentry's Vite plugin
// doesn't instrument a middleware array that contains a function call.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => {
  return {
    requestMiddleware: [sentryGlobalRequestMiddleware, csrfMiddleware],
    functionMiddleware: [sentryGlobalFunctionMiddleware],
  };
});`,
            },
          ],
        },
        {
          type: 'alert',
          alertType: 'info',
          showIcon: false,
          text: t(
            'The Sentry middleware should be the first middleware in the arrays to ensure all errors are captured.'
          ),
        },
        {
          type: 'text',
          text: tct(
            'To capture errors from route loaders, error boundaries and [code:errorComponent]s, and to send events through a tunnel to avoid ad blockers, follow the [link:TanStack Start React guide].',
            {
              code: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/manual-setup/#capture-tanstack-start-react-errors" />
              ),
            }
          ),
        },
      ],
    },
    {
      title: t('Upload Source Maps (Optional)'),
      content: [
        {
          type: 'text',
          text: tct(
            'If you configured the [code:sentryTanstackStart] Vite plugin as shown above, source maps will be automatically uploaded to Sentry during the build process and deleted from your build output afterwards.',
            {code: <code />}
          ),
        },
        {
          type: 'text',
          text: tct(
            'For alternative source map upload methods, follow the [link:Vite source maps guide].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/sourcemaps/uploading/vite/" />
              ),
            }
          ),
        },
      ],
      collapsible: true,
    },
    getDataCollectionStep({
      docsLink:
        'https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/configuration/options/#dataCollection',
    }),
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
    params.isLogsSelected
      ? `
    // Send a log before throwing the error
    Sentry.logger.info('User triggered test error', {
      action: 'test_error_button_click',
    });`
      : ''
  }${
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
                  filename: 'src/routes/api/sentry-example.ts',
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
  nextSteps: params => {
    const steps = [
      {
        id: 'tanstackstart-features',
        name: t('TanStack Start Features'),
        description: t(
          'Learn about our first class integration with the TanStack Start framework.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/features/',
      },
    ];

    if (params.isLogsSelected) {
      steps.push({
        id: 'logs',
        name: t('Logging Integrations'),
        description: t(
          'Add logging integrations to automatically capture logs from your application.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/logs/#integrations',
      });
    }

    if (params.isMetricsSelected) {
      steps.push({
        id: 'metrics',
        name: t('Application Metrics'),
        description: t(
          'Learn how to track custom metrics to monitor your application performance and business KPIs.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/metrics/',
      });
    }

    return steps;
  },
};

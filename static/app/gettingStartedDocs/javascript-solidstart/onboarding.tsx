import {ExternalLink} from 'sentry/components/core/link';
import type {
  ContentBlock,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {t, tct} from 'sentry/locale';

import {getSdkClientSetupSnippet, installSnippetBlock} from './utils';

function getSdkServerSetupSnippet(params: DocsParams) {
  return `
import * as Sentry from "@sentry/solidstart";

Sentry.init({
  dsn: "${params.dsn.public}",
  ${
    params.isPerformanceSelected
      ? `
        // Performance Monitoring
        tracesSampleRate: 1.0, //  Capture 100% of the transactions
        // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
        tracePropagationTargets: ["localhost", /^https:\\/\\/yourserver\\.io\\/api/],`
      : ''
  }${
    params.isProfilingSelected
      ? `
          // Set profilesSampleRate to 1.0 to profile every transaction.
          // Since profilesSampleRate is relative to tracesSampleRate,
          // the final profiling rate can be computed as tracesSampleRate * profilesSampleRate
          // For example, a tracesSampleRate of 0.5 and profilesSampleRate of 0.5 would
          // results in 25% of transactions being profiled (0.5*0.5=0.25)
          profilesSampleRate: 1.0,`
      : ''
  }
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});
`;
}

const getSdkMiddlewareSetup = () => `
import { sentryBeforeResponseMiddleware } from '@sentry/solidstart/middleware';
import { createMiddleware } from '@solidjs/start/middleware';

export default createMiddleware({
  onBeforeResponse: [
    sentryBeforeResponseMiddleware(),
    // Add your other middleware handlers after \`sentryBeforeResponseMiddleware\`
  ],
});
`;

const getSdkMiddlewareLinkSetup = () => `
import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  middleware: "./src/middleware.ts"
  // Other configuration options
  // ...
});
`;

const getSdkRouterWrappingSetup = () => `
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { withSentryRouterRouting } from "@sentry/solidstart/solidrouter";

const SentryRouter = withSentryRouterRouting(Router);

export default function App() {
  return (
    <SentryRouter>
      <FileRoutes />
    </SentryRouter>
  );
}
`;

const getSdkRun = () => `
{
  "scripts": {
    "start": "NODE_OPTIONS='--import ./public/instrument.server.mjs' vinxi start"
  }
}
`;

const getVerifySnippet = (params: DocsParams) => {
  const logsCode = params.isLogsSelected
    ? `
    // Send a log before throwing the error
    Sentry.logger.info('User triggered test error', {
      action: 'test_error_button_click',
    });`
    : '';

  const metricsCode = params.isMetricsSelected
    ? `
    // Send a test metric before throwing the error
    Sentry.metrics.count('test_counter', 1);`
    : '';

  return `
<button
  type="button"
  onClick={() => {${logsCode}${metricsCode}
    throw new Error("Sentry Frontend Error");
  }}
>
  Throw error
</button>`;
};

export const onboarding: OnboardingConfig = {
  introduction: () =>
    tct(
      "In this quick guide you'll use [strong:npm], [strong:yarn] or [strong:pnpm] to set up:",
      {
        strong: <strong />,
      }
    ),
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Add the Sentry SDK as a dependency using [code:npm], [code:yarn] or [code:pnpm]:',
            {
              code: <code />,
            }
          ),
        },
        installSnippetBlock,
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
            "Initialize Sentry as early as possible in your application's lifecycle."
          ),
        },
        {
          type: 'text',
          text: tct(
            'For the client, initialize the Sentry SDK in your [code:src/entry-client.tsx] file',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'TypeScript',
              // language are in JS to get consistent syntax highlighting
              // we aren't using any Typescript specific code in these snippets but
              // want a typescript ending.
              language: 'javascript',
              code: getSdkClientSetupSnippet(params),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'For the server, create an instrument file [code:instrument.server.mjs], initialize the Sentry SDK and deploy it alongside your application. For example by placing it in the [code:public] folder.',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: getSdkServerSetupSnippet(params),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'Note: Placing [code:instrument.server.mjs] inside the [code:public] folder makes it accessible to the outside world. Consider blocking requests to this file or finding a more appropriate location which your backend can access.',
            {code: <code />}
          ),
        },
        ...((params.isPerformanceSelected
          ? [
              {
                type: 'text',
                text: tct(
                  'Complete the setup by adding the Sentry [solidStartMiddlewareLink: middleware] to your [code:src/middleware.ts] file',
                  {
                    code: <code />,
                    solidStartMiddlewareLink: (
                      <ExternalLink href="https://docs.solidjs.com/solid-start/advanced/middleware" />
                    ),
                  }
                ),
              },
              {
                type: 'code',
                tabs: [
                  {
                    label: 'TypeScript',
                    language: 'javascript',
                    code: getSdkMiddlewareSetup(),
                  },
                ],
              },
              {
                type: 'text',
                text: tct('And including it in the [code:app.config.ts] file', {
                  code: <code />,
                }),
              },
              {
                type: 'code',
                tabs: [
                  {
                    label: 'TypeScript',
                    language: 'javascript',
                    code: getSdkMiddlewareLinkSetup(),
                  },
                ],
              },
              {
                type: 'text',
                text: tct(
                  "If you're using [solidRouterLink:Solid Router], wrap your [code:Router] with [code:withSentryRouterRouting]. This creates a higher order component, which will enable Sentry to collect navigation spans.",
                  {
                    code: <code />,
                    solidRouterLink: (
                      <ExternalLink href="https://docs.solidjs.com/solid-router" />
                    ),
                  }
                ),
              },
              {
                type: 'code',
                tabs: [
                  {
                    label: 'TypeScript',
                    language: 'typescript',
                    code: getSdkRouterWrappingSetup(),
                  },
                ],
              },
            ]
          : []) as ContentBlock[]),
        {
          type: 'text',
          text: tct(
            'Add an [code:--import] flag to the [code:NODE_OPTIONS] environment variable wherever you run your application to import [code:public/instrument.server.mjs]. For example, update your [code:scripts] entry in [code:package.json]',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JSON',
              language: 'json',
              code: getSdkRun(),
            },
          ],
        },
      ],
    },
    getUploadSourceMapsStep({
      description: tct(
        'To upload source maps to Sentry, follow the [link:instructions in our documentation].',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/solidstart/#add-readable-stack-traces-to-errors" />
          ),
        }
      ),
      ...params,
    }),
  ],
  verify: (params: DocsParams) => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: getVerifySnippet(params),
            },
          ],
        },
      ],
    },
  ],
  nextSteps: (params: DocsParams) => {
    const steps = [
      {
        id: 'solid-features',
        name: t('Solid Features'),
        description: t(
          'Learn about our first class integration with the Solid framework.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/solid/features/',
      },
    ];

    if (params.isLogsSelected) {
      steps.push({
        id: 'logs',
        name: t('Logging Integrations'),
        description: t(
          'Add logging integrations to automatically capture logs from your application.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/solidstart/logs/#integrations',
      });
    }

    return steps;
  },
};

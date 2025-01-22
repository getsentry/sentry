import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import crashReportCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/crashReportCallout';
import widgetCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/widgetCallout';
import TracePropagationMessage from 'sentry/components/onboarding/gettingStartedDoc/replay/tracePropagationMessage';
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
import {featureFlagOnboarding} from 'sentry/gettingStartedDocs/javascript/javascript';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getSdkClientSetupSnippet = (params: Params) => `
import * as Sentry from "@sentry/solidstart";
${params.isPerformanceSelected ? 'import { solidRouterBrowserTracingIntegration } from "@sentry/solidstart/solidrouter";' : ''}
import { mount, StartClient } from "@solidjs/start/client";

Sentry.init({
  dsn: "${params.dsn.public}",
  integrations: [${
    params.isPerformanceSelected
      ? `
        solidRouterBrowserTracingIntegration(),`
      : ''
  }${
    params.isProfilingSelected
      ? `
          Sentry.browserProfilingIntegration(),`
      : ''
  }${
    params.isFeedbackSelected
      ? `
        Sentry.feedbackIntegration({
  // Additional SDK configuration goes in here, for example:
  colorScheme: "system",
  ${getFeedbackConfigOptions(params.feedbackOptions)}}),`
      : ''
  }${
    params.isReplaySelected
      ? `
          Sentry.replayIntegration(${getReplayConfigOptions(params.replayOptions)}),`
      : ''
  }
  ],${
    params.isPerformanceSelected
      ? `
  // Performance Monitoring
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
  tracePropagationTargets: ["localhost", /^https:\\/\\/yourserver\\.io\\/api/],`
      : ''
  }${
    params.isReplaySelected
      ? `
  // Session Replay
  replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
  replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.`
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
});

mount(() => <StartClient />, document.getElementById("app"));
`;

const getSdkServerSetupSnippet = (params: Params) => `
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
});
`;

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

const getVerifySnippet = () => `
<button
  type="button"
  onClick={() => {
    throw new Error("Sentry Frontend Error");
  }}
>
  Throw error
</button>`;

const getInstallConfig = () => [
  {
    language: 'bash',
    code: [
      {
        label: 'npm',
        value: 'npm',
        language: 'bash',
        code: 'npm install --save @sentry/solidstart',
      },
      {
        label: 'yarn',
        value: 'yarn',
        language: 'bash',
        code: 'yarn add @sentry/solidstart',
      },
      {
        label: 'pnpm',
        value: 'pnpm',
        language: 'bash',
        code: `pnpm add @sentry/solidstart`,
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
          'In this quick guide you’ll use [strong:npm], [strong:yarn] or [strong:pnpm] to set up:',
          {
            strong: <strong />,
          }
        )}
      </p>
    </Fragment>
  ),
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Add the Sentry SDK as a dependency using [code:npm], [code:yarn] or [code:pnpm]:',
        {
          code: <code />,
        }
      ),
      configurations: getInstallConfig(),
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: t(
        "Initialize Sentry as early as possible in your application's lifecycle."
      ),
      configurations: [
        {
          description: tct(
            'For the client, initialize the Sentry SDK in your [code:src/entry-client.tsx] file',
            {code: <code />}
          ),
          code: [
            {
              label: 'TypeScript',
              // value and language are in JS to get consistent syntax highlighting
              // we aren't using any Typescript specific code in these snippets but
              // want a typescript ending.
              value: 'javascript',
              language: 'javascript',
              code: getSdkClientSetupSnippet(params),
            },
          ],
        },
        {
          description: tct(
            'For the server, create an instrument file [code:instrument.server.mjs], initialize the Sentry SDK and deploy it alongside your application. For example by placing it in the [code:public] folder.',
            {code: <code />}
          ),
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getSdkServerSetupSnippet(params),
            },
          ],
          additionalInfo: tct(
            'Note: Placing [code:instrument.server.mjs] inside the [code:public] folder makes it accessible to the outside world. Consider blocking requests to this file or finding a more appropriate location which your backend can access.',
            {code: <code />}
          ),
        },
        ...(params.isPerformanceSelected
          ? [
              {
                description: tct(
                  'Complete the setup by adding the Sentry [solidStartMiddlewareLink: middleware] to your [code:src/middleware.ts] file',
                  {
                    code: <code />,
                    solidStartMiddlewareLink: (
                      <ExternalLink href="https://docs.solidjs.com/solid-start/advanced/middleware" />
                    ),
                  }
                ),
                code: [
                  {
                    label: 'TypeScript',
                    // value and language are in JS to get consistent syntax highlighting
                    // we aren't using any Typescript specific code in these snippets but
                    // want a typescript ending.
                    value: 'javascript',
                    language: 'javascript',
                    code: getSdkMiddlewareSetup(),
                  },
                ],
              },
              {
                description: tct('And including it in the [code:app.config.ts] file', {
                  code: <code />,
                }),
                code: [
                  {
                    label: 'TypeScript',
                    value: 'javascript',
                    language: 'javascript',
                    code: getSdkMiddlewareLinkSetup(),
                  },
                ],
              },
              {
                description: tct(
                  "If you're using [solidRouterLink:Solid Router], wrap your [code:Router] with [code:withSentryRouterRouting]. This creates a higher order component, which will enable Sentry to collect navigation spans.",
                  {
                    code: <code />,
                    solidRouterLink: (
                      <ExternalLink href="https://docs.solidjs.com/solid-router" />
                    ),
                  }
                ),
                code: [
                  {
                    label: 'TypeScript',
                    value: 'typescript',
                    language: 'typescript',
                    code: getSdkRouterWrappingSetup(),
                  },
                ],
              },
            ]
          : []),
        ...(params.isProfilingSelected
          ? [getProfilingDocumentHeaderConfigurationStep()]
          : []),
        {
          description: tct(
            'Add an [code:--import] flag to the [code:NODE_OPTIONS] environment variable wherever you run your application to import [code:public/instrument.server.mjs]. For example, update your [code:scripts] entry in [code:package.json]',
            {
              code: <code />,
            }
          ),
          code: [
            {
              label: 'JSON',
              value: 'json',
              language: 'json',
              code: getSdkRun(),
            },
          ],
        },
      ],
    },
    {
      title: t('Upload Source Maps'),
      description: tct(
        'To upload source maps to Sentry, follow the [link:instructions in our documentation].',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/solidstart/#add-readable-stack-traces-to-errors" />
          ),
        }
      ),
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t(
        "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
      ),
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getVerifySnippet(),
            },
          ],
        },
      ],
    },
  ],
  nextSteps: () => [
    {
      id: 'solid-features',
      name: t('Solid Features'),
      description: t('Learn about our first class integration with the Solid framework.'),
      link: 'https://docs.sentry.io/platforms/javascript/guides/solid/features/',
    },
  ],
};

const replayOnboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'You need a minimum version 8.9.1 of [code:@sentry/solid] in order to use Session Replay. You do not need to install any additional packages.',
        {
          code: <code />,
        }
      ),
      configurations: getInstallConfig(),
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: getReplayConfigureDescription({
        link: 'https://docs.sentry.io/platforms/javascript/guides/solid/session-replay/',
      }),
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getSdkClientSetupSnippet(params),
            },
          ],
          additionalInfo: <TracePropagationMessage />,
        },
      ],
    },
  ],
  verify: getReplayVerifyStep(),
  nextSteps: () => [],
};

const feedbackOnboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'For the User Feedback integration to work, you must have the Sentry browser SDK package, or an equivalent framework SDK (e.g. [code:@sentry/solid]) installed, minimum version 7.85.0.',
        {
          code: <code />,
        }
      ),
      configurations: getInstallConfig(),
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: getFeedbackConfigureDescription({
        linkConfig:
          'https://docs.sentry.io/platforms/javascript/guides/solid/user-feedback/configuration/',
        linkButton:
          'https://docs.sentry.io/platforms/javascript/guides/solid/user-feedback/configuration/#bring-your-own-button',
      }),
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getSdkClientSetupSnippet(params),
            },
          ],
        },
      ],
      additionalInfo: crashReportCallout({
        link: 'https://docs.sentry.io/platforms/javascript/guides/solid/user-feedback/#crash-report-modal',
      }),
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
        link: 'https://docs.sentry.io/platforms/javascript/guides/solid/user-feedback/configuration/#crash-report-modal',
      }),
      additionalInfo: widgetCallout({
        link: 'https://docs.sentry.io/platforms/javascript/guides/solid/user-feedback/#user-feedback-widget',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const profilingOnboarding: OnboardingConfig = {
  ...onboarding,
  introduction: params => <MaybeBrowserProfilingBetaWarning {...params} />,
};

const docs: Docs = {
  onboarding,
  feedbackOnboardingNpm: feedbackOnboarding,
  replayOnboarding,
  crashReportOnboarding,
  profilingOnboarding,
  featureFlagOnboarding,
};

export default docs;

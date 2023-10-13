import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';

// Configuration Start
const replayIntegration = `
new Sentry.Replay(),
`;

const replayOtherConfig = `
// Session Replay
replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
`;

const performanceIntegration = `
new Sentry.BrowserTracing({
  // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
  tracePropagationTargets: ["localhost", /^https:\\/\\/yourserver\\.io\\/api/],
  routingInstrumentation: Sentry.remixRouterInstrumentation(
    useEffect,
    useLocation,
    useMatches
  ),
}),
`;

const performanceOtherConfig = `
// Performance Monitoring
tracesSampleRate: 1.0, // Capture 100% of the transactions`;

const prismaIntegration = `new Sentry.Integrations.Prisma({ client: prisma }),`;

export const steps = ({
  sentryInitContent,
  sentryInitContentServer,
}: {
  sentryInitContent?: string;
  sentryInitContentServer?: string[];
} = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <p>
        {tct(
          'Add the Sentry SDK as a dependency using [codeNpm:npm] or [codeYarn:yarn]:',
          {
            codeYarn: <code />,
            codeNpm: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'bash',
        code: [
          {
            label: 'npm',
            value: 'npm',
            language: 'bash',
            code: 'npm install --save @sentry/remix',
          },
          {
            label: 'yarn',
            value: 'yarn',
            language: 'bash',
            code: 'yarn add @sentry/remix',
          },
        ],
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct(
          'Import and initialize Sentry in your Remix entry points for the client ([clientFile:entry.client.tsx]):',
          {
            clientFile: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
        import { useLocation, useMatches } from "@remix-run/react";
        import * as Sentry from "@sentry/remix";
        import { useEffect } from "react";

        Sentry.init({
          ${sentryInitContent}
        });
        `,
      },
      {
        language: 'javascript',
        description: (
          <p>
            {tct(
              `Initialize Sentry in your entry point for the server ([serverFile:entry.server.tsx]) to capture exceptions and get performance metrics for your [action] and [loader] functions. You can also initialize Sentry's database integrations, such as Prisma, to get spans for your database calls:`,
              {
                action: (
                  <ExternalLink href="https://remix.run/docs/en/v1/api/conventions#action" />
                ),
                loader: (
                  <ExternalLink href="https://remix.run/docs/en/1.18.1/api/conventions#loader" />
                ),
                serverFile: <code />,
              }
            )}
          </p>
        ),
        code: `
        ${
          (sentryInitContentServer ?? []).length > 1
            ? `import { prisma } from "~/db.server";`
            : ''
        }

        import * as Sentry from "@sentry/remix";

        Sentry.init({
          ${sentryInitContentServer?.join('\n')}
        });
        `,
      },
      {
        description: t(
          'Lastly, wrap your Remix root with "withSentry" to catch React component errors and to get parameterized router transactions:'
        ),
        language: 'javascript',
        code: `
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";

import { withSentry } from "@sentry/remix";

function App() {
  return (
    <html>
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}

export default withSentry(App);
        `,
      },
    ],
  },
  {
    type: StepType.VERIFY,
    description: t(
      "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
    ),
    configurations: [
      {
        language: 'jsx',
        code: `
<button type="button" onClick={() => { throw new Error("Sentry Frontend Error") }}>
  Throw Test Error
</button>
        `,
      },
    ],
  },
];

export const nextSteps = [
  {
    id: 'source-maps',
    name: t('Source Maps'),
    description: t('Learn how to enable readable stack traces in your Sentry errors.'),
    link: 'https://docs.sentry.io/platforms/javascript/guides/remix/sourcemaps/',
  },
  {
    id: 'performance-monitoring',
    name: t('Performance Monitoring'),
    description: t(
      'Track down transactions to connect the dots between 10-second page loads and poor-performing API calls or slow database queries.'
    ),
    link: 'https://docs.sentry.io/platforms/javascript/guides/remix/performance/',
  },
  {
    id: 'session-replay',
    name: t('Session Replay'),
    description: t(
      'Get to the root cause of an error or latency issue faster by seeing all the technical details related to that issue in one visual replay on your web application.'
    ),
    link: 'https://docs.sentry.io/platforms/javascript/guides/remix/session-replay/',
  },
];
// Configuration End

export function GettingStartedWithRemix({
  dsn,
  activeProductSelection = [],
  ...props
}: ModuleProps) {
  const integrations: string[] = [];
  const otherConfigs: string[] = [];

  const serverIntegrations: string[] = [];
  const otherConfigsServer: string[] = [];

  let nextStepDocs = [...nextSteps];

  if (activeProductSelection.includes(ProductSolution.PERFORMANCE_MONITORING)) {
    integrations.push(performanceIntegration.trim());
    otherConfigs.push(performanceOtherConfig.trim());
    serverIntegrations.push(prismaIntegration.trim());
    otherConfigsServer.push(performanceOtherConfig.trim());
    nextStepDocs = nextStepDocs.filter(
      step => step.id !== ProductSolution.PERFORMANCE_MONITORING
    );
  }

  if (activeProductSelection.includes(ProductSolution.SESSION_REPLAY)) {
    integrations.push(replayIntegration.trim());
    otherConfigs.push(replayOtherConfig.trim());
    nextStepDocs = nextStepDocs.filter(
      step => step.id !== ProductSolution.SESSION_REPLAY
    );
  }

  let sentryInitContent: string[] = [`dsn: "${dsn}",`];
  let sentryInitContentServer: string[] = [`dsn: "${dsn}",`];

  if (integrations.length > 0) {
    sentryInitContent = sentryInitContent.concat('integrations: [', integrations, '],');
  }

  if (serverIntegrations.length) {
    sentryInitContentServer = sentryInitContentServer.concat(
      'integrations: [',
      serverIntegrations,
      '],'
    );
  }

  if (otherConfigs.length > 0) {
    sentryInitContent = sentryInitContent.concat(otherConfigs);
  }

  if (otherConfigsServer.length) {
    sentryInitContentServer = sentryInitContentServer.concat(otherConfigsServer);
  }

  return (
    <Layout
      steps={steps({
        sentryInitContent: sentryInitContent.join('\n'),
        sentryInitContentServer,
      })}
      nextSteps={nextStepDocs}
      {...props}
    />
  );
}

export default GettingStartedWithRemix;

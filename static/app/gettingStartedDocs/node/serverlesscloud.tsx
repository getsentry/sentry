import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {PlatformKey} from 'sentry/data/platformCategories';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types';

type StepProps = {
  newOrg: boolean;
  organization: Organization;
  platformKey: PlatformKey;
  projectId: string;
  sentryInitContent: string;
};

const performanceIntegrations: string[] = [
  `// enable HTTP calls tracing
  new Sentry.Integrations.Http({ tracing: true }),`,
  `// enable Express.js middleware tracing
  new Sentry.Integrations.Express({ app }),`,
  `// Automatically instrument Node.js libraries and frameworks
  ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),`,
];

const performanceOtherConfig = `environment: params.INSTANCE_NAME,
// Performance Monitoring
// Capture 100% of the transactions, reduce in production!
tracesSampleRate: 1.0, `;

export const steps = ({
  sentryInitContent,
  ...props
}: Partial<StepProps> = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <p>{tct('Add [code:@sentry/node] as a dependency:', {code: <code />})}</p>
    ),
    configurations: [
      {
        language: 'bash',
        code: `cloud install @sentry/node:`,
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct('Sentry should be initialized as early in your app as possible.', {
          code: <code />,
        })}
      </p>
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
        import api from "@serverless/cloud";
import * as Sentry from "@sentry/node";

// or using CommonJS
// const api = require("@serverless/cloud");
// const Sentry = require('@sentry/node');

Sentry.init({
  ${sentryInitContent},
});

// RequestHandler creates a separate execution context, so that all
// transactions/spans/breadcrumbs are isolated across requests
api.use(Sentry.Handlers.requestHandler());
// TracingHandler creates a trace for every incoming request
api.use(Sentry.Handlers.tracingHandler());

// All controllers should live here
api.get("/", function rootHandler(req, res) {
  res.end("Hello world!");
});

// The error handler must be before any other error middleware and after all controllers
api.use(Sentry.Handlers.errorHandler());

// Optional fallthrough error handler
api.use(function onError(err, req, res, next) {
  // The error id is attached to \`res.sentry\` to be returned
  // and optionally displayed to the user for support.
  res.statusCode = 500;
  res.end(res.sentry + "\\n");
});
        `,
      },
    ],
  },
  getUploadSourceMapsStep({
    guideLink:
      'https://docs.sentry.io/platforms/node/guides/serverless-cloud/sourcemaps/',
    ...props,
  }),
  {
    type: StepType.VERIFY,
    description: t(
      "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
        api.get("/debug-sentry", function mainHandler(req, res) {
          throw new Error("My first Sentry error!");
        });
        `,
      },
    ],
  },
];

export function GettingStartedWithServerlesscloud({
  dsn,
  organization,
  newOrg,
  platformKey,
  projectId,
}: ModuleProps) {
  let sentryInitContent: string[] = [`dsn: "${dsn}",`];

  const integrations = [...performanceIntegrations];
  const otherConfigs = [performanceOtherConfig];

  if (integrations.length > 0) {
    sentryInitContent = sentryInitContent.concat('integrations: [', integrations, '],');
  }

  if (otherConfigs.length > 0) {
    sentryInitContent = sentryInitContent.concat(otherConfigs);
  }

  return (
    <Layout
      steps={steps({
        sentryInitContent: sentryInitContent.join('\n'),
        organization,
        newOrg,
        platformKey,
        projectId,
      })}
      newOrg={newOrg}
      platformKey={platformKey}
    />
  );
}

export default GettingStartedWithServerlesscloud;

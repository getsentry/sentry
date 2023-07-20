import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {PlatformKey} from 'sentry/data/platformCategories';
import {tct} from 'sentry/locale';
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
      {
        language: 'javascript',
        description: (
          <p>
            {tct(
              'The above configuration captures both error and performance data. To reduce the volume of performance data captured, change [code:tracesSampleRate] to a value between 0 and 1. You can verify the Sentry integration is working by creating a route that will throw an error:',
              {code: <code />}
            )}
          </p>
        ),
        code: `
        api.get("/debug-sentry", function mainHandler(req, res) {
          throw new Error("My first Sentry error!");
        });
    `,
      },
      {
        language: 'javascript',
        description: (
          <p>
            {tct(
              '[code:requestHandler] accepts some options that let you decide what data should be included in the event sent to Sentry. Possible options are:',
              {code: <code />}
            )}
          </p>
        ),
        code: `
// keys to be extracted from req
request?: boolean | string[]; // default: true = ['cookies', 'data', 'headers', 'method', 'query_string', 'url']

// server name
serverName?: boolean; // default: true

// generate transaction name
//   path == request.path (eg. "/foo")
//   methodPath == request.method + request.path (eg. "GET|/foo")
//   handler == function name (eg. "fooHandler")
transaction?: boolean | 'path' | 'methodPath' | 'handler'; // default: true = 'methodPath'

// keys to be extracted from req.user
user?: boolean | string[]; // default: true = ['id', 'username', 'email']

// client ip address
ip?: boolean; // default: false

// node version
version?: boolean; // default: true

// timeout for fatal route errors to be delivered
flushTimeout?: number; // default: undefined
    `,
      },
      {
        language: 'javascript',
        description: (
          <p>
            {tct(
              'For example, if you want to skip the server name and add just user, you would use [code:requestHandler] like this:',
              {code: <code />}
            )}
          </p>
        ),
        code: `
        api.use(
          Sentry.Handlers.requestHandler({
            serverName: false,
            user: ["email"],
          })
        );
    `,
      },
      {
        language: 'javascript',
        description: (
          <p>
            {tct(
              'By default, [code:errorHandler] will capture only errors with a status code of [code:500] or higher. If you want to change it, provide it with the [code:shouldHandleError] callback, which accepts middleware errors as its argument and decides, whether an error should be sent or not, by returning an appropriate boolean value.',
              {code: <code />}
            )}
          </p>
        ),
        code: `
        api.use(
          Sentry.Handlers.errorHandler({
            shouldHandleError(error) {
              // Capture all 404 and 500 errors
              if (error.status === 404 || error.status === 500) {
                return true;
              }
              return false;
            },
          })
        );
    `,
      },
    ],
  },
  getUploadSourceMapsStep({
    guideLink: 'https://docs.sentry.io/platforms/node/guides/express/sourcemaps/',
    ...props,
  }),
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

import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getSdkSetupSnippet = (params: Params) => `
const api = require("@serverless/cloud");
const Sentry = require('@sentry/node');

// or using ESM
// import api from "@serverless/cloud";
// import * as Sentry from "@sentry/node";

Sentry.init({
dsn: "${params.dsn}",
integrations: [
// enable HTTP calls tracing
new Sentry.Integrations.Http({ tracing: true }),
// enable Express.js middleware tracing
new Sentry.Integrations.Express({ app }),
// Automatically instrument Node.js libraries and frameworks
...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
],
environment: params.INSTANCE_NAME,
// Performance Monitoring
// Capture 100% of the transactions
tracesSampleRate: 1.0,
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
});`;

const getVerifySnippet = () => `
api.get("/debug-sentry", function mainHandler(req, res) {
  throw new Error("My first Sentry error!");
});
`;

const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct('Add [code:@sentry/node] as a dependency:', {code: <code />}),
      configurations: [
        {
          language: 'bash',
          code: `cloud install @sentry/node:`,
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: t('Sentry should be initialized as early in your app as possible.'),
      configurations: [
        {
          language: 'javascript',
          code: getSdkSetupSnippet(params),
        },
      ],
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
          language: 'javascript',
          code: getVerifySnippet(),
        },
      ],
    },
  ],
};

const docs: Docs = {
  onboarding,
};

export default docs;

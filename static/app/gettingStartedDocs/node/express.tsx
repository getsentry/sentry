import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import replayOnboardingJsLoader from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {t, tct} from 'sentry/locale';
import {
  getDefaultNodeImports,
  getInstallSnippet,
  ProductSelectionMap,
} from 'sentry/utils/gettingStartedDocs/node';

type Params = DocsParams;

const productSelection = (params: Params): ProductSelectionMap => {
  return {
    [ProductSolution.ERROR_MONITORING]: true,
    [ProductSolution.PROFILING]: params.isProfilingSelected,
    [ProductSolution.PERFORMANCE_MONITORING]: params.isPerformanceSelected,
    [ProductSolution.SESSION_REPLAY]: params.isReplaySelected,
  };
};

const getSdkSetupSnippet = (params: Params) => `
${getDefaultNodeImports({productSelection: productSelection(params)}).join('\n')}
import express from "express";

const app = express();

Sentry.init({
  dsn: "${params.dsn}",
  integrations: [${
    params.isPerformanceSelected
      ? `
      // enable HTTP calls tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // enable Express.js middleware tracing
      new Sentry.Integrations.Express({ app }),`
      : ''
  }${
    params.isProfilingSelected
      ? `
      new ProfilingIntegration(),`
      : ''
  }
],${
  params.isPerformanceSelected
    ? `
      // Performance Monitoring
      tracesSampleRate: 1.0, //  Capture 100% of the transactions`
    : ''
}${
  params.isProfilingSelected
    ? `
    // Set sampling rate for profiling - this is relative to tracesSampleRate
    profilesSampleRate: 1.0,`
    : ''
}
});

// The request handler must be the first middleware on the app
app.use(Sentry.Handlers.requestHandler());${
  params.isPerformanceSelected
    ? `

// TracingHandler creates a trace for every incoming request
app.use(Sentry.Handlers.tracingHandler());`
    : ''
}

// All your controllers should live here
app.get("/", function rootHandler(req, res) {
  res.end("Hello world!");
});

// The error handler must be registered before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

// Optional fallthrough error handler
app.use(function onError(err, req, res, next) {
  // The error id is attached to \`res.sentry\` to be returned
  // and optionally displayed to the user for support.
  res.statusCode = 500;
  res.end(res.sentry + "\\n");
});

app.listen(3000);
`;

const onboarding: OnboardingConfig = {
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      description: t('Add the Sentry Node SDK as a dependency:'),
      configurations: [
        {
          code: [
            {
              label: 'npm',
              value: 'npm',
              language: 'bash',
              code: getInstallSnippet({
                productSelection: productSelection(params),
                packageManager: 'npm',
              }),
            },
            {
              label: 'yarn',
              value: 'yarn',
              language: 'bash',
              code: getInstallSnippet({
                productSelection: productSelection(params),
                packageManager: 'yarn',
              }),
            },
          ],
        },
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        "Initialize Sentry as early as possible in your application's lifecycle, for example in your [code:index.ts/js] entry point:",
        {code: <code />}
      ),
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getSdkSetupSnippet(params),
            },
          ],
        },
      ],
    },
    getUploadSourceMapsStep({
      guideLink: 'https://docs.sentry.io/platforms/node/sourcemaps/',
    }),
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
          code: `
          app.get("/debug-sentry", function mainHandler(req, res) {
            throw new Error("My first Sentry error!");
          });
          `,
        },
      ],
    },
  ],
};

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
};

export default docs;

import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';
import {
  getDefaulServerlessImports,
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

const getInstallSnippet = (params: Params) => `
dependencies: {
  //...
  "@sentry/serverless": "^7",${
    params.isProfilingSelected
      ? `
  "@sentry/profiling-node": "^1",`
      : ''
  }
  //...
}`;

const getSdkSetupSnippet = (params: Params) => `
${getDefaulServerlessImports({productSelection: productSelection(params)}).join('\n')}

Sentry.GCPFunction.init({
  dsn: "${params.dsn}",
  integrations: [${
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

// Use wrapHttpFunction to instrument your http functions
exports.helloHttp = Sentry.GCPFunction.wrapHttpFunction((req, res) => {
  /* Your function code */
});

// Use wrapEventFunction to instrument your background functions
exports.helloEvents = Sentry.GCPFunction.wrapEventFunction(
  (data, context, callback) => {
    /* Your function code */
  }
);

// Use wrapCloudEventFunction to instrument your CloudEvent functions
exports.helloEvents = Sentry.GCPFunction.wrapCloudEventFunction(
  (context, callback) => {
    /* Your function code */
  }
);`;

const getVerifySnippet = () => `
exports.helloHttp = Sentry.GCPFunction.wrapHttpFunction((req, res) => {
  throw new Error("oh, hello there!");
});`;

const onboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Add the Sentry Serverless SDK as a dependency to your [code:package.json]:',
        {code: <code />}
      ),
      configurations: [
        {
          language: 'json',
          code: getInstallSnippet(params),
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct('Use the Sentry SDK to wrap your functions:', {
        code: <code />,
      }),
      configurations: [
        {
          language: 'javascript',
          code: getSdkSetupSnippet(params),
        },
      ],
    },
    getUploadSourceMapsStep({
      guideLink: 'https://docs.sentry.io/platforms/node/guides/gcp-functions/sourcemaps/',
      ...params,
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

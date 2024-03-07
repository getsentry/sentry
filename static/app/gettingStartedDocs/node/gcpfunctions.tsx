import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {
  getCrashReportJavaScriptInstallStep,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {getJSServerMetricsOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';
import type {ProductSelectionMap} from 'sentry/utils/gettingStartedDocs/node';
import {getDefaulServerlessImports} from 'sentry/utils/gettingStartedDocs/node';

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

const getMetricsConfigureSnippet = (params: DocsParams) => `
Sentry.GCPFunction.init({
  dsn: "${params.dsn}",
  _experiments: {
    metricsAggregator: true,
  },
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

const customMetricsOnboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      description: tct(
        'You need a minimum version [codeVersion:7.91.0] of [codePackage:@sentry/serverless]:',
        {
          codeVersion: <code />,
          codePackage: <code />,
        }
      ),
      configurations: [{language: 'json', code: getInstallSnippet(params)}],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'To enable capturing metrics, you first need to add the [codeIntegration:metricsAggregator] experiment to your [codeNamespace:Sentry.init] call in your main process.',
        {
          codeIntegration: <code />,
          codeNamespace: <code />,
        }
      ),
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getMetricsConfigureSnippet(params),
            },
          ],
        },
      ],
    },
  ],
  verify: getJSServerMetricsOnboarding().verify,
};

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportJavaScriptInstallStep(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getCrashReportModalConfigDescription({
        link: 'https://docs.sentry.io/platforms/node/guides/gcp-functions/user-feedback/configuration/#crash-report-modal',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  customMetricsOnboarding,
  crashReportOnboarding,
};

export default docs;

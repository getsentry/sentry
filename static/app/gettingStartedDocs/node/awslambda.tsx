import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';
import type {ProductSelectionMap} from 'sentry/utils/gettingStartedDocs/node';
import {
  getDefaulServerlessImports,
  getInstallConfig,
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
${getDefaulServerlessImports({productSelection: productSelection(params)}).join('\n')}

Sentry.AWSLambda.init({
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

exports.handler = Sentry.AWSLambda.wrapHandler(async (event, context) => {
  // Your handler code
});`;

const getVerifySnippet = () => `
exports.handler = Sentry.AWSLambda.wrapHandler(async (event, context) => {
  throw new Error("This should show up in Sentry!")
});`;

const onboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      description: t('Add the Sentry Serverless SDK as a dependency:'),
      configurations: getInstallConfig(params, {
        basePackage: '@sentry/serverless',
      }),
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        "Wrap your lambda handler with Sentry's [code:wraphandler] function:",
        {
          code: <code />,
        }
      ),
      configurations: [
        {
          language: 'javascript',
          code: getSdkSetupSnippet(params),
        },
      ],
    },
    getUploadSourceMapsStep({
      guideLink: 'https://docs.sentry.io/platforms/node/guides/aws-lambda/sourcemaps/',
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

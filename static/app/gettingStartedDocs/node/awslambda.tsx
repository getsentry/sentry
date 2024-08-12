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
import {t, tct} from 'sentry/locale';
import {getInstallConfig, getSdkInitSnippet} from 'sentry/utils/gettingStartedDocs/node';

type Params = DocsParams;

const getSdkSetupSnippet = (params: Params) => `
// IMPORTANT: Make sure to import and initialize Sentry at the top of your file.
${getSdkInitSnippet(params, 'aws')}
// Place any other require/import statements here

exports.handler = Sentry.wrapHandler(async (event, context) => {
  // Your handler code
});`;

const getVerifySnippet = () => `
exports.handler = Sentry.wrapHandler(async (event, context) => {
  throw new Error("This should show up in Sentry!")
});`;

const getMetricsConfigureSnippet = (params: DocsParams) => `
Sentry.init({
  dsn: "${params.dsn.public}",
  // Only needed for SDK versions < 8.0.0
  // _experiments: {
  //   metricsAggregator: true,
  // },
});`;

const onboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      description: t('Add the Sentry AWS Serverless SDK as a dependency:'),
      configurations: getInstallConfig(params, {
        basePackage: '@sentry/aws-serverless',
      }),
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        "Ensure that Sentry is imported and initialized at the beginning of your file, prior to any other [require:require] or [import:import] statements. Then, wrap your lambda handler with Sentry's [code:wraphandler] function:",
        {
          import: <code />,
          require: <code />,
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
      guideLink:
        'https://docs.sentry.io/platforms/javascript/guides/aws-lambda/sourcemaps/',
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
        'You need a minimum version [codeVersion:8.0.0] of [codePackage:@sentry/aws-serverless]:',
        {
          codeVersion: <code />,
          codePackage: <code />,
        }
      ),
      configurations: getInstallConfig(params, {
        basePackage: '@sentry/aws-serverless',
      }),
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: t(
        'With the default snippet in place, there is no need for any further configuration.'
      ),
      configurations: [
        {
          code: getMetricsConfigureSnippet(params),
          language: 'javascript',
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
        link: 'https://docs.sentry.io/platforms/javascript/guides/aws-lambda/user-feedback/configuration/#crash-report-modal',
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

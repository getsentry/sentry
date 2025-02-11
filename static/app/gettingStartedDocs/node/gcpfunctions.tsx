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
import {t, tct} from 'sentry/locale';
import {getInstallConfig, getSdkInitSnippet} from 'sentry/utils/gettingStartedDocs/node';

type Params = DocsParams;

const getSdkSetupSnippet = (params: Params) => `
// IMPORTANT: Make sure to import and initialize Sentry at the top of your file.
${getSdkInitSnippet(params, 'gpc')}
// Place any other require/import statements here

// Use wrapHttpFunction to instrument your http functions
exports.helloHttp = Sentry.wrapHttpFunction((req, res) => {
  /* Your function code */
});

// Use wrapEventFunction to instrument your background functions
exports.helloEvents = Sentry.wrapEventFunction(
  (data, context, callback) => {
    /* Your function code */
  }
);

// Use wrapCloudEventFunction to instrument your CloudEvent functions
exports.helloEvents = Sentry.wrapCloudEventFunction(
  (context, callback) => {
    /* Your function code */
  }
);`;

const getVerifySnippet = () => `
exports.helloHttp = Sentry.wrapHttpFunction((req, res) => {
  throw new Error("oh, hello there!");
});`;

const onboarding: OnboardingConfig = {
  introduction: () =>
    tct('In this quick guide you’ll use [strong:npm] or [strong:yarn] to set up:', {
      strong: <strong />,
    }),
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
          configurations: getInstallConfig(params, {
            basePackage: '@sentry/google-cloud-serverless',
          }),
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'Ensure that Sentry is imported and initialized at the beginning of your file, prior to any other [code:require] or [code:import] statements. Then, use the Sentry SDK to wrap your functions:',
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
      guideLink:
        'https://docs.sentry.io/platforms/javascript/guides/gcp-functions/sourcemaps/',
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

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportJavaScriptInstallStep(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getCrashReportModalConfigDescription({
        link: 'https://docs.sentry.io/platforms/javascript/guides/gcp-functions/user-feedback/configuration/#crash-report-modal',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  crashReportOnboarding,
};

export default docs;

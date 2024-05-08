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
import {
  getInstallConfig,
  getNodeRunCommandSnippet,
  getSdkInitSnippet,
  getSentryImportsSnippet,
} from 'sentry/utils/gettingStartedDocs/node';

type Params = DocsParams;

const getSdkSetupSnippet = () => `
${getSentryImportsSnippet('aws-serverless')}

exports.handler = Sentry.wrapHandler(async (event, context) => {
  // Your handler code
});`;

const getVerifySnippet = () => `
exports.handler = Sentry.wrapHandler(async (event, context) => {
  throw new Error("This should show up in Sentry!")
});`;

const getMetricsConfigureSnippet = (params: DocsParams) => `
Sentry.init({
  dsn: "${params.dsn}",
  _experiments: {
    metricsAggregator: true,
  },
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
      description: t(
        "Initialize Sentry as early as possible in your application's lifecycle. Otherwise, auto-instrumentation will not work."
      ),
      configurations: [
        {
          description: tct(
            'To initialize the SDK before everything else, create an external file called [code:instrument.ts/js].',
            {code: <code />}
          ),
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              filename: 'instrument.(js|mjs|ts)',
              code: getSdkInitSnippet(params, 'aws'),
            },
          ],
        },
        {
          description: tct(
            'Modify the Node.js command to include the [code1:--require] option. This preloads [code2:instrument.(js|mjs|ts)] at startup.',
            {code1: <code />, code2: <code />}
          ),
          code: [
            {
              label: 'Bash',
              value: 'bash',
              language: 'bash',
              code: getNodeRunCommandSnippet(),
            },
          ],
        },
        {
          description: tct(
            "Wrap your lambda handler with Sentry's [code:wraphandler] function:",
            {code: <code />}
          ),
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getSdkSetupSnippet(),
            },
          ],
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

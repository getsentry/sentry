import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {
  getInstallCodeBlock,
  getSdkInitSnippet,
} from 'sentry/gettingStartedDocs/node/utils';
import {t, tct} from 'sentry/locale';

const getSdkSetupSnippet = (params: DocsParams) => `
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

const getVerifySnippet = (params: DocsParams) => `
exports.helloHttp = Sentry.wrapHttpFunction((req, res) => {${
  params.isLogsSelected
    ? `
  // Send a log before throwing the error
  Sentry.logger.info('User triggered test error', {
    action: 'test_error_function',
  });`
    : ''
}${
  params.isMetricsSelected
    ? `
  // Send a test metric before throwing the error
  Sentry.metrics.count('test_counter', 1);`
    : ''
}
  throw new Error("oh, hello there!");
});`;

export const onboarding: OnboardingConfig = {
  introduction: () =>
    tct("In this quick guide you'll use [strong:npm] or [strong:yarn] to set up:", {
      strong: <strong />,
    }),
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Add the Sentry Serverless SDK as a dependency to your [code:package.json]:',
            {code: <code />}
          ),
        },
        getInstallCodeBlock(params, {
          packageName: '@sentry/google-cloud-serverless',
        }),
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Ensure that Sentry is imported and initialized at the beginning of your file, prior to any other [code:require] or [code:import] statements. Then, use the Sentry SDK to wrap your functions:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
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
  verify: (params: DocsParams) => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: getVerifySnippet(params),
        },
      ],
    },
  ],
  nextSteps: (params: DocsParams) => {
    const steps = [];

    if (params.isLogsSelected) {
      steps.push({
        id: 'logs',
        name: t('Logging Integrations'),
        description: t(
          'Add logging integrations to automatically capture logs from your application.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/gcp-functions/logs/#integrations',
      });
    }

    return steps;
  },
};

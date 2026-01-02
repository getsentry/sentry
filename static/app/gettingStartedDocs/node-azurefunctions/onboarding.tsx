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
"use strict";
// IMPORTANT: Make sure to import and initialize Sentry at the top of your file.
${getSdkInitSnippet(params, 'node')}
// Place any other require/import statements here

module.exports = async function (context, req) {
  try {
    await notExistFunction();
  } catch (e) {
    Sentry.captureException(e);
    await Sentry.flush(2000);
  }

  context.res = {
    status: 200,
    body: "Hello from Azure Cloud Function!",
  };
};
`;

const getVerifySnippet = (params: DocsParams) => `
${
  params.isMetricsSelected
    ? `// Send a test metric before throwing the error
Sentry.metrics.count('test_counter', 1);
`
    : ''
}throw new Error("This should show up in Sentry!");`;

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
          text: t('Add the Sentry Node SDK as a dependency:'),
        },
        getInstallCodeBlock(params),
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
            'Ensure that Sentry is imported and initialized at the beginning of your file, prior to any other [code:require] or [code:import] statements.',
            {code: <code />}
          ),
        },
        {
          type: 'text',
          text: tct(
            'Note: You need to call both [code:captureException] and [code:flush] for captured events to be successfully delivered to Sentry.',
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
        'https://docs.sentry.io/platforms/javascript/guides/azure-functions/sourcemaps/',
      ...params,
    }),
  ],
  verify: params => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Verify that your Sentry installation is working by triggering a test error in your Azure Function:'
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
  nextSteps: params => {
    const steps = [];

    if (params.isLogsSelected) {
      steps.push({
        id: 'logs',
        name: t('Logging Integrations'),
        description: t(
          'Add logging integrations to automatically capture logs from your application.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/azure-functions/logs/#integrations',
      });
    }

    return steps;
  },
};

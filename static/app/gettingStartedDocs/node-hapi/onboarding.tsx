import {ExternalLink} from '@sentry/scraps/link';

import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {
  getImport,
  getInstallCodeBlock,
  getSdkInitSnippet,
} from 'sentry/gettingStartedDocs/node/utils';
import {t, tct} from 'sentry/locale';

const getSdkSetupSnippet = () => `
${getImport('@sentry/node', 'esm-only').join('\n')}
import Hapi from "@hapi/hapi";

const init = async () => {
  const server = Hapi.server({
    port: 3030,
    host: 'localhost',
  });

  // All your routes live here

  await server.start();
};

init();
`;

const getVerifySnippet = (params: DocsParams) => `
server.route({
  method: 'GET',
  path: '/debug-sentry',
  handler: function (request, h) {${
    params.isLogsSelected
      ? `
    // Send a log before throwing the error
    Sentry.logger.info('User triggered test error', {
      action: 'test_error_endpoint',
    });`
      : ''
  }${
    params.isMetricsSelected
      ? `
    // Send a test metric before throwing the error
    Sentry.metrics.count('test_counter', 1);`
      : ''
  }
    throw new Error('My first Sentry error!');
  }
});
`;

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
          text: t(
            "Initialize Sentry as early as possible in your application's lifecycle."
          ),
        },
        {
          type: 'text',
          text: tct(
            'To initialize the SDK before everything else, create an external file called [code:instrument.mjs].',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              filename: 'instrument.mjs',
              code: getSdkInitSnippet(params, 'node', 'esm-only'),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'Start your application with the [code:--import] flag, so that [code:instrument.mjs] loads before any other module. For alternative ways to set up Sentry, read about [docs:installation methods in our docs].',
            {
              code: <code />,
              docs: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/hapi/install/" />
              ),
            }
          ),
        },
        {
          type: 'code',
          language: 'bash',
          code: 'node --import ./instrument.mjs index.mjs',
        },
        {
          type: 'text',
          text: tct(
            'This is what your application entry point, usually [code:index.mjs], looks like:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              filename: 'index.mjs',
              code: getSdkSetupSnippet(),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'The default [code:hapiIntegration] captures errors from your routes automatically. You do not have to add an error handler.',
            {code: <code />}
          ),
        },
      ],
    },
    getUploadSourceMapsStep({
      guideLink: 'https://docs.sentry.io/platforms/javascript/guides/hapi/sourcemaps/',
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
        link: 'https://docs.sentry.io/platforms/javascript/guides/hapi/logs/#integrations',
      });
    }

    return steps;
  },
};

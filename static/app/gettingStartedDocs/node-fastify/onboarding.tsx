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
import Fastify from "fastify";

const fastify = Fastify();

fastify.get("/", function rootHandler(req, res) {
  res.send("Hello world!");
});

fastify.listen({ port: 3000 });
`;

export const onboarding: OnboardingConfig = {
  introduction: () =>
    tct("In this quick guide you'll use [strong:npm] or [strong:yarn] to set up:", {
      strong: <strong />,
    }),
  install: (params: DocsParams) => [
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
  configure: (params: DocsParams) => [
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
            'To initialize the SDK before everything else, create an external file called [code:instrument.js]. These snippets use ESM syntax, so your [code:package.json] needs [code:"type": "module"].',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              filename: 'instrument.js',
              code: getSdkInitSnippet(params, 'node', 'esm-only'),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'Start your application with the [code:--import] flag, so that [code:instrument.js] loads before any other module. For alternative ways to set up Sentry, read about [docs:installation methods in our docs].',
            {
              code: <code />,
              docs: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/fastify/install/" />
              ),
            }
          ),
        },
        {
          type: 'code',
          language: 'bash',
          code: 'node --import ./instrument.js index.js',
        },
        {
          type: 'text',
          text: tct(
            'This is what your application entry point, usually [code:index.js], looks like:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              filename: 'index.js',
              code: getSdkSetupSnippet(),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'The default [code:fastifyIntegration] captures errors from your route handlers automatically. You do not have to add an error handler.',
            {code: <code />}
          ),
        },
      ],
    },
    getUploadSourceMapsStep({
      guideLink: 'https://docs.sentry.io/platforms/javascript/guides/fastify/sourcemaps/',
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
          code: `
fastify.get("/debug-sentry", function mainHandler(req, res) {${
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
  throw new Error("My first Sentry error!");
});
          `,
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
        link: 'https://docs.sentry.io/platforms/javascript/guides/fastify/logs/#integrations',
      });
    }

    if (params.isMetricsSelected) {
      steps.push({
        id: 'metrics',
        name: t('Application Metrics'),
        description: t(
          'Learn how to track custom metrics to monitor your application performance and business KPIs.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/fastify/metrics/',
      });
    }

    return steps;
  },
};

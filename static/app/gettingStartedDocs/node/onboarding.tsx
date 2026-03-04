import {ExternalLink} from '@sentry/scraps/link';

import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getAISetupStep,
  getUploadSourceMapsStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {t, tct} from 'sentry/locale';

import {
  getImportInstrumentSnippet,
  getInstallCodeBlock,
  getSdkInitSnippet,
} from './utils';

const getSdkSetupSnippet = () => `
${getImportInstrumentSnippet()}

// All other imports below
const { createServer } = require("node:http");

const server = createServer((req, res) => {
  // server code
});

server.listen(3000, "127.0.0.1");
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
            'To initialize the SDK before everything else, create an external file called [code:instrument.js/mjs].',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              filename: 'instrument.(js|mjs)',
              code: getSdkInitSnippet(params, 'node'),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            "Make sure to import [code:instrument.js/mjs] at the top of your file. Set up the error handler after all controllers and before any other error middleware. This setup is typically done in your application's entry point file, which is usually [code:index.(js|ts)]. If you're running your application in ESM mode, or looking for alternative ways to set up Sentry, read about [docs:installation methods in our docs].",
            {
              code: <code />,
              docs: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/node/install/" />
              ),
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              filename: 'instrument.(js|mjs)',
              code: getSdkSetupSnippet(),
            },
          ],
        },
      ],
    },
    getUploadSourceMapsStep({
      guideLink: 'https://docs.sentry.io/platforms/javascript/guides/node/sourcemaps/',
      ...params,
    }),
    getAISetupStep({skillPath: 'sentry-sdk-setup'}),
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
          code: params.isPerformanceSelected
            ? `
const Sentry = require("@sentry/node");

Sentry.startSpan({
  op: "test",
  name: "My First Test Span",
}, () => {
  try {${
    params.isLogsSelected
      ? `
    // Send a log before throwing the error
    Sentry.logger.info('User triggered test error', {
      action: 'test_error_span',
    });`
      : ''
  }${
    params.isMetricsSelected
      ? `
    // Send a test metric before throwing the error
    Sentry.metrics.count('test_counter', 1);`
      : ''
  }
    foo();
  } catch (e) {
    Sentry.captureException(e);
  }
});`
            : `
const Sentry = require("@sentry/node");
${
  params.isLogsSelected
    ? `
// Send a log before throwing the error
Sentry.logger.info('User triggered test error', {
  action: 'test_error_basic',
});`
    : ''
}${
                params.isMetricsSelected
                  ? `
// Send a test metric before throwing the error
Sentry.metrics.count('test_counter', 1);`
                  : ''
              }
try {
  foo();
} catch (e) {
  Sentry.captureException(e);
}`,
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
        link: 'https://docs.sentry.io/platforms/javascript/guides/node/logs/#integrations',
      });
    }

    if (params.isMetricsSelected) {
      steps.push({
        id: 'metrics',
        name: t('Metrics'),
        description: t(
          'Learn how to track custom metrics to monitor your application performance and business KPIs.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/node/metrics/',
      });
    }

    return steps;
  },
};

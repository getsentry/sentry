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

import {getInstallCodeBlock, getSdkInitSnippet} from './utils';

const getEntryPointSnippet = () => `import { createServer } from "node:http";

const server = createServer((req, res) => {
  // server code
});

server.listen(3000, "127.0.0.1");`;

/**
 * The log and metric calls the verify snippet makes before it throws.
 *
 * @param indent The whitespace put in front of every line.
 */
const getVerifySignalsSnippet = (params: DocsParams, indent: string) =>
  `${
    params.isLogsSelected
      ? `
${indent}// Send a log before throwing the error
${indent}Sentry.logger.info('User triggered test error', {
${indent}  action: 'test_error',
${indent}});`
      : ''
  }${
    params.isMetricsSelected
      ? `
${indent}// Send a test metric before throwing the error
${indent}Sentry.metrics.count('test_counter', 1);`
      : ''
  }`;

const getVerifySnippet = (params: DocsParams) => {
  if (!params.isPerformanceSelected) {
    return `
import * as Sentry from "@sentry/node";
${getVerifySignalsSnippet(params, '')}
try {
  foo();
} catch (e) {
  Sentry.captureException(e);
}`;
  }

  return `
import * as Sentry from "@sentry/node";

Sentry.startSpan({
  op: "test",
  name: "My First Test Span",
}, () => {
  try {${getVerifySignalsSnippet(params, '    ')}
    foo();
  } catch (e) {
    Sentry.captureException(e);
  }
});`;
};

export const onboarding: OnboardingConfig = {
  hideInstructionsCopy: true,
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
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/node/install/" />
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
              code: getEntryPointSnippet(),
            },
          ],
        },
      ],
    },
    getUploadSourceMapsStep({
      guideLink: 'https://docs.sentry.io/platforms/javascript/guides/node/sourcemaps/',
      ...params,
    }),
    getAISetupStep({sdkName: 'Node.js'}),
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

    if (params.isPerformanceSelected) {
      steps.push({
        id: 'tracing',
        name: t('Tracing'),
        description: t(
          'Learn which libraries the SDK instruments for you, and how to add your own spans.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/node/tracing/',
      });
    }

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
        name: t('Application Metrics'),
        description: t(
          'Learn how to track custom metrics to monitor your application performance and business KPIs.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/node/metrics/',
      });
    }

    return steps;
  },
};

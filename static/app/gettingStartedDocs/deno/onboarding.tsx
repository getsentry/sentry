import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

import {getInstallContent, getSdkInitSnippet, PACKAGE_NAME, sentryImport} from './utils';

const INSTRUMENT_FILENAME = 'instrument.ts';
const ENTRY_POINT_FILENAME = 'main.ts';

const getEntryPointSnippet = () => `
import "./${INSTRUMENT_FILENAME}";

// All other imports below
Deno.serve((_req) => new Response("Hello World!"));`;

const getAutoInstrumentationSnippet = () =>
  `deno run --import=${PACKAGE_NAME}/import ${ENTRY_POINT_FILENAME}`;

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
    return `${sentryImport}
${getVerifySignalsSnippet(params, '')}

setTimeout(() => {
  throw new Error();
});`;
  }

  return `${sentryImport}

Sentry.startSpan({
  op: "test",
  name: "My First Test Span",
}, () => {${getVerifySignalsSnippet(params, '  ')}
  throw new Error();
});`;
};

export const onboarding: OnboardingConfig = {
  introduction: () =>
    t(
      "In this quick guide you'll set up and configure the Sentry Deno SDK for the use in your Deno application."
    ),
  install: () => [
    {
      type: StepType.INSTALL,
      content: getInstallContent(t('Add the Sentry Deno SDK as a dependency:')),
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Put the [code:Sentry.init()] call in its own [code:instrument.ts] file, so that it runs before the rest of your code.',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'typescript',
          filename: INSTRUMENT_FILENAME,
          code: getSdkInitSnippet(params),
        },
        {
          type: 'text',
          text: tct(
            'Import [code:instrument.ts] at the top of your entry point, before every other import. Incoming [code:Deno.serve] and [code:node:http] requests are then instrumented for you.',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'typescript',
          filename: ENTRY_POINT_FILENAME,
          code: getEntryPointSnippet(),
        },
        {
          type: 'conditional',
          condition: params.isPerformanceSelected,
          content: [
            {
              type: 'text',
              text: tct(
                'Some libraries, for example [code:mysql] or [code:postgres], do not emit tracing signals on their own. To instrument them, start your app with the [code:--import] flag.',
                {code: <code />}
              ),
            },
            {
              type: 'code',
              language: 'bash',
              code: getAutoInstrumentationSnippet(),
            },
          ],
        },
      ],
    },
  ],
  verify: params => [
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
          language: 'typescript',
          code: getVerifySnippet(params),
        },
      ],
    },
  ],
  nextSteps: params => {
    const steps = [];

    if (params.isPerformanceSelected) {
      steps.push({
        id: 'tracing',
        name: t('Tracing'),
        description: t(
          'Learn which libraries the SDK instruments for you, and how to add your own spans.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/deno/tracing/',
      });
    }

    if (params.isLogsSelected) {
      steps.push({
        id: 'logs',
        name: t('Logging Integrations'),
        description: t(
          'Add logging integrations to automatically capture logs from your application.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/deno/logs/#integrations',
      });
    }

    if (params.isMetricsSelected) {
      steps.push({
        id: 'metrics',
        name: t('Application Metrics'),
        description: t(
          'Learn how to track custom metrics to monitor your application performance and business KPIs.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/deno/metrics/',
      });
    }

    return steps;
  },
};

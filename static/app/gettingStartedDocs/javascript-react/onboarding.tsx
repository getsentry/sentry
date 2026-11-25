import {tracePropagationBlock} from 'sentry/components/onboarding/gettingStartedDoc/replay/tracePropagationMessage';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getAISetupStep,
  getDataCollectionStep,
  getUploadSourceMapsStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {t, tct} from 'sentry/locale';

import {
  entryPointSnippet,
  errorBoundarySnippet,
  getSdkSetupSnippet,
  installSnippetBlock,
} from './utils';

const getVerifySnippet = (params: DocsParams) => {
  const logsCode = params.isLogsSelected
    ? `
        // Send a log before throwing the error
        Sentry.logger.info('User triggered test error', {
          action: 'test_error_button_click',
        });`
    : '';

  const metricsCode = params.isMetricsSelected
    ? `
        // Send a test metric before throwing the error
        Sentry.metrics.count('test_counter', 1);`
    : '';

  return `import * as Sentry from '@sentry/react';
// Add this button component to your app to test Sentry's error tracking
function ErrorButton() {
  return (
    <button
      onClick={() => {${logsCode}${metricsCode}
        throw new Error('This is your first error!');
      }}
    >
      Break the world
    </button>
  );
}`;
};

export const onboarding: OnboardingConfig = {
  hideInstructionsCopy: true,
  introduction: () =>
    tct(
      "In this quick guide you'll use [strong:npm], [strong:yarn], or [strong:pnpm] to set up:",
      {strong: <strong />}
    ),
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Add the Sentry SDK as a dependency using [code:npm], [code:yarn], or [code:pnpm]:',
            {code: <code />}
          ),
        },
        installSnippetBlock,
      ],
    },
  ],
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Create an [code:instrument.js] file next to your entry point, and initialize Sentry in it:',
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
              code: getSdkSetupSnippet(params),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'Import [code:instrument.js] as the first import of your entry point, so Sentry starts before the rest of your app. On React 19 and later, pass [code:Sentry.reactErrorHandler()] to [code:createRoot] to capture the errors that React handles:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              filename: 'main.jsx',
              code: entryPointSnippet,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'On React 18 and earlier, wrap your app in [code:Sentry.ErrorBoundary] to capture rendering errors and show a fallback UI:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              filename: 'App.jsx',
              code: errorBoundarySnippet,
            },
          ],
        },
        {
          type: 'conditional',
          condition: params.isReplaySelected,
          content: [tracePropagationBlock],
        },
      ],
    },
    getUploadSourceMapsStep({
      guideLink: 'https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/',
      ...params,
    }),
    getAISetupStep({sdkName: 'React'}),
    getDataCollectionStep({
      docsLink:
        'https://docs.sentry.io/platforms/javascript/guides/react/configuration/options/#dataCollection',
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
          tabs: [
            {label: 'React', language: 'javascript', code: getVerifySnippet(params)},
          ],
        },
      ],
    },
  ],
  nextSteps: (params: DocsParams) => {
    const steps = [
      {
        id: 'react-features',
        name: t('React Features'),
        description: t(
          'Learn about our first class integration with the React framework.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/react/features/',
      },
    ];

    if (params.isPerformanceSelected) {
      steps.push({
        id: 'react-router',
        name: t('React Router'),
        description: t(
          'Configure routing, so Sentry can generate parameterized route names for better grouping of tracing data.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/react/configuration/integrations/react-router/',
      });
    }

    if (params.isLogsSelected) {
      steps.push({
        id: 'logs',
        name: t('Logging Integrations'),
        description: t(
          'Add logging integrations to automatically capture logs from your application.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/react/logs/#integrations',
      });
    }

    if (params.isMetricsSelected) {
      steps.push({
        id: 'metrics',
        name: t('Application Metrics'),
        description: t(
          'Learn how to track custom metrics to monitor your application performance and business KPIs.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/react/metrics/',
      });
    }

    return steps;
  },
};

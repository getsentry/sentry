import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {t, tct} from 'sentry/locale';

import {getSdkSetupSnippet, installSnippetBlock} from './utils';

const getVerifySnippet = (params: DocsParams, isVersion5: boolean) => {
  const logsCode = params.isLogsSelected
    ? `    // Send a log before throwing the error
    Sentry.logger.info('User triggered test error', {
      action: 'test_error_button_click',
    });
`
    : '';

  const metricsCode = params.isMetricsSelected
    ? `    // Send a test metric before throwing the error
    Sentry.metrics.count('test_counter', 1);
`
    : '';

  const errorCode =
    logsCode || metricsCode
      ? `${logsCode}${metricsCode}    throw new Error("This is your first error!");`
      : `throw new Error("This is your first error!")`;

  return isVersion5
    ? `
// SomeComponent.svelte
<button type="button" onclick="{() => {${errorCode}}}">
  Break the world
</button>`
    : `
// SomeComponent.svelte
<button type="button" on:click="{() => {${errorCode}}}">
  Break the world
</button>`;
};

export const onboarding: OnboardingConfig = {
  introduction: () =>
    tct(
      "In this quick guide you'll use [strong:npm], [strong:yarn], or [strong:pnpm] to set up:",
      {
        strong: <strong />,
      }
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
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            "Initialize Sentry as early as possible in your application's lifecycle, usually your Svelte app's entry point ([code:main.ts/js]):",
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Svelte v5',
              language: 'javascript',
              code: getSdkSetupSnippet(params, true),
            },
            {
              label: 'Svelte v3/v4',
              language: 'javascript',
              code: getSdkSetupSnippet(params, false),
            },
          ],
        },
      ],
    },
    getUploadSourceMapsStep({
      guideLink: 'https://docs.sentry.io/platforms/javascript/guides/svelte/sourcemaps/',
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
          tabs: [
            {
              label: 'Svelte v5',
              language: 'html',
              code: getVerifySnippet(params, true),
            },
            {
              label: 'Svelte v3/v4',
              language: 'html',
              code: getVerifySnippet(params, false),
            },
          ],
        },
      ],
    },
  ],
  nextSteps: params => {
    const steps = [
      {
        id: 'svelte-features',
        name: t('Svelte Features'),
        description: t(
          'Learn about our first class integration with the Svelte framework.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/svelte/features/',
      },
    ];

    if (params.isLogsSelected) {
      steps.push({
        id: 'logs',
        name: t('Logging Integrations'),
        description: t(
          'Add logging integrations to automatically capture logs from your application.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/svelte/logs/#integrations',
      });
    }

    if (params.isMetricsSelected) {
      steps.push({
        id: 'metrics',
        name: t('Metrics'),
        description: t(
          'Learn how to track custom metrics to monitor your application performance and business KPIs.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/svelte/metrics/',
      });
    }

    return steps;
  },
};

import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {t, tct} from 'sentry/locale';

import {
  getSetupCodeBlock,
  installSnippetBlock,
  type Params,
  type PlatformOptions,
} from './utils';

const getVerifySnippet = (params: Params) => {
  const sentryImport =
    params.isLogsSelected || params.isMetricsSelected
      ? `import * as Sentry from "@sentry/vue";

`
      : '';
  const logsCode = params.isLogsSelected
    ? `      // Send a log before throwing the error
      Sentry.logger.info('User triggered test error', {
        action: 'test_error_button_click',
      });
`
    : '';
  const metricsCode = params.isMetricsSelected
    ? `      // Send a test metric before throwing the error
      Sentry.metrics.count('test_counter', 1);
`
    : '';

  return `<script>
${sentryImport}export default {
  methods: {
    triggerError() {
${logsCode}${metricsCode}      throw new Error('Sentry Test Error');
    },
  },
};
</script>

<template>
  <button type="button" @click="triggerError">Break the world</button>
</template>`;
};

export const onboarding: OnboardingConfig<PlatformOptions> = {
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
            "Initialize Sentry as early as possible in your application's lifecycle, usually your Vue app's entry point ([code:main.ts/js]).",
            {code: <code />}
          ),
        },
        getSetupCodeBlock(params),
      ],
    },
    getUploadSourceMapsStep({
      guideLink: 'https://docs.sentry.io/platforms/javascript/guides/vue/sourcemaps/',
      ...params,
    }),
  ],
  verify: (params: Params) => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: tct(
            'Add this button to a Vue component, such as [code:App.vue], then click "Break the world" to send a test error to Sentry. If you selected Logs or Metrics, clicking the button sends those too.',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Vue',
              language: 'html',
              filename: 'App.vue',
              code: getVerifySnippet(params),
            },
          ],
        },
      ],
    },
  ],
  nextSteps: (params: Params) => {
    const steps = [
      {
        id: 'vue-features',
        name: t('Vue Features'),
        description: t('Learn about our first class integration with the Vue framework.'),
        link: 'https://docs.sentry.io/platforms/javascript/guides/vue/features/',
      },
    ];

    if (params.isLogsSelected) {
      steps.push({
        id: 'logs',
        name: t('Logging Integrations'),
        description: t(
          'Add logging integrations to automatically capture logs from your application.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/vue/logs/#integrations',
      });
    }

    if (params.isMetricsSelected) {
      steps.push({
        id: 'metrics',
        name: t('Application Metrics'),
        description: t(
          'Learn how to track custom metrics to monitor your application performance and business KPIs.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/vue/metrics/',
      });
    }

    return steps;
  },
};

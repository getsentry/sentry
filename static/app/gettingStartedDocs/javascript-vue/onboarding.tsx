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
  const metricsCode = params.isMetricsSelected
    ? `  // Send a test metric before calling undefined function
  Sentry.metrics.count('test_counter', 1);
`
    : '';

  return `${metricsCode}myUndefinedFunction();`;
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
          text: t(
            "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
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
        name: t('Metrics'),
        description: t(
          'Learn how to track custom metrics to monitor your application performance and business KPIs.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/vue/metrics/',
      });
    }

    return steps;
  },
};

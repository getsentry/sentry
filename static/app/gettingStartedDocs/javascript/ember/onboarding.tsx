import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {t, tct} from 'sentry/locale';

import {getSdkSetupSnippet, installSnippetBlock} from './utils';

const getVerifyEmberSnippet = (params: DocsParams) => {
  const logsCode = params.isLogsSelected
    ? `// Send a log before throwing the error
    Sentry.logger.info(Sentry.logger.fmt\`User \${"sentry-test"} triggered test error button\`, {
      action: "test_error_button_click",
    });
`
    : '';

  const metricsCode = params.isMetricsSelected
    ? `// Send a test metric before throwing the error
    Sentry.metrics.count('test_counter', 1);
`
    : '';

  return `
import * as Sentry from "@sentry/ember";

setTimeout(() => {
  ${logsCode}${metricsCode}throw new Error("Sentry Test Error");
});`;
};

export const onboarding: OnboardingConfig = {
  introduction: () =>
    tct("In this quick guide you'll use [strong:npm] or [strong:yarn] to set up:", {
      strong: <strong />,
    }),
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: t(
            "Sentry captures data by using an SDK within your application's runtime."
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
            'You should [code:init] the Sentry SDK as soon as possible during your application load up in [code:app.js], before initializing Ember:',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: getSdkSetupSnippet(params),
            },
          ],
        },
      ],
    },
    getUploadSourceMapsStep({
      guideLink: 'https://docs.sentry.io/platforms/javascript/guides/ember/sourcemaps/',
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
              label: 'JavaScript',
              language: 'javascript',
              code: getVerifyEmberSnippet(params),
            },
          ],
        },
      ],
    },
  ],
  nextSteps: (params: DocsParams) => {
    const steps = [
      {
        id: 'ember-configuration',
        name: t('Configure Ember Options'),
        description: t(
          'Learn about additional configuration options for the Ember addon.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/ember/configuration/ember-options/',
      },
    ];

    if (params.isLogsSelected) {
      steps.push({
        id: 'logs',
        name: t('Logging Integrations'),
        description: t(
          'Add logging integrations to automatically capture logs from your application.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/ember/logs/#integrations',
      });
    }

    if (params.isMetricsSelected) {
      steps.push({
        id: 'metrics',
        name: t('Metrics'),
        description: t(
          'Learn how to track custom metrics to monitor your application performance and business KPIs.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/ember/metrics/',
      });
    }

    return steps;
  },
};

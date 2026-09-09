import type {
  ContentBlock,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {t, tct} from 'sentry/locale';

import {getSdkSetupSnippet, installSnippetBlock} from './utils';

const getVerifyEmberSnippet = (params: DocsParams) => {
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

  return `import Component from "@glimmer/component";
import { action } from "@ember/object";
${
  params.isLogsSelected || params.isMetricsSelected
    ? 'import * as Sentry from "@sentry/ember";\n'
    : ''
}
export default class SentryTestComponent extends Component {
  @action
  triggerError() {
${logsCode}${metricsCode}    throw new Error("Sentry Test Error");
  }
}`;
};

export const onboarding: OnboardingConfig = {
  introduction: () =>
    tct("In this quick guide you'll use the [strong:Ember CLI] to set up:", {
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
            'Initialize Sentry in [code:app/app.js], before the Application class. Keep the [code:loadInitializers] call so Ember loads your initializers:',
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
              filename: 'app/app.js',
              code: getSdkSetupSnippet(params),
            },
          ],
        },
        ...((params.isPerformanceSelected
          ? [
              {
                type: 'text',
                text: tct(
                  'To enable tracing, create [code:app/instance-initializers/sentry-performance.js]. The v2 addon does not register performance instrumentation automatically:',
                  {code: <code />}
                ),
              },
              {
                type: 'code',
                tabs: [
                  {
                    label: 'JavaScript',
                    language: 'javascript',
                    filename: 'app/instance-initializers/sentry-performance.js',
                    code: `import { instrumentAppInstancePerformance } from "@sentry/ember";

export function initialize(appInstance) {
  instrumentAppInstancePerformance(appInstance);
}

export default { initialize };`,
                  },
                ],
              },
            ]
          : []) satisfies ContentBlock[]),
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
          text: tct(
            'Create a [code:SentryTest] component with the following class and template:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              filename: 'app/components/sentry-test.js',
              code: getVerifyEmberSnippet(params),
            },
          ],
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Handlebars',
              language: 'html',
              filename: 'app/components/sentry-test.hbs',
              code: `<button type="button" {{on "click" this.triggerError}}>
  Break the world
</button>`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'Render [code:<SentryTest />] in an application template, then click "Break the world" to send a test error to Sentry. If you selected Logs or Metrics, clicking the button sends those too.',
            {code: <code />}
          ),
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
        name: t('Application Metrics'),
        description: t(
          'Learn how to track custom metrics to monitor your application performance and business KPIs.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/ember/metrics/',
      });
    }

    return steps;
  },
};

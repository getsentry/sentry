import crashReportCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/crashReportCallout';
import widgetCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/widgetCallout';
import TracePropagationMessage from 'sentry/components/onboarding/gettingStartedDoc/replay/tracePropagationMessage';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
  PlatformOption,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {
  getCrashReportJavaScriptInstallStep,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
  getFeedbackConfigureDescription,
  getFeedbackSDKSetupSnippet,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {getJSMetricsOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import {
  getReplayConfigOptions,
  getReplayConfigureDescription,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';

export enum VueVersion {
  VUE3 = 'vue3',
  VUE2 = 'vue2',
}

type PlatformOptionKey = 'siblingOption';

const platformOptions: Record<PlatformOptionKey, PlatformOption> = {
  siblingOption: {
    label: t('Vue Version'),
    items: [
      {
        label: t('Vue 3'),
        value: VueVersion.VUE3,
      },
      {
        label: t('Vue 2'),
        value: VueVersion.VUE2,
      },
    ],
  },
};

type PlatformOptions = typeof platformOptions;
type Params = DocsParams<PlatformOptions>;

const getSentryInitLayout = (params: Params, siblingOption: string): string => {
  return `Sentry.init({
    ${siblingOption === VueVersion.VUE2 ? `Vue,` : ''}dsn: "${params.dsn}",
    integrations: [${
      params.isPerformanceSelected
        ? `
          Sentry.browserTracingIntegration(),`
        : ''
    }${
      params.isReplaySelected
        ? `
          Sentry.replayIntegration(${getReplayConfigOptions(params.replayOptions)}),`
        : ''
    }
  ],${
    params.isPerformanceSelected
      ? `
        // Performance Monitoring
        tracesSampleRate: 1.0, //  Capture 100% of the transactions
        // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
        tracePropagationTargets: ["localhost", /^https:\\/\\/yourserver\\.io\\/api/],`
      : ''
  }${
    params.isReplaySelected
      ? `
        // Session Replay
        replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
        replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.`
      : ''
  }
  });`;
};

const getInstallConfig = () => [
  {
    language: 'bash',
    code: [
      {
        label: 'npm',
        value: 'npm',
        language: 'bash',
        code: `npm install --save @sentry/vue`,
      },
      {
        label: 'yarn',
        value: 'yarn',
        language: 'bash',
        code: `yarn add @sentry/vue`,
      },
    ],
  },
];

const getNextStep = (
  params: Params
): {
  description: string;
  id: string;
  link: string;
  name: string;
}[] => {
  let nextStepDocs = [...nextSteps];

  if (params.isPerformanceSelected) {
    nextStepDocs = nextStepDocs.filter(
      step => step.id !== ProductSolution.PERFORMANCE_MONITORING
    );
  }

  if (params.isReplaySelected) {
    nextStepDocs = nextStepDocs.filter(
      step => step.id !== ProductSolution.SESSION_REPLAY
    );
  }
  return nextStepDocs;
};

const onboarding: OnboardingConfig<PlatformOptions> = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: (
        <p>
          {tct(
            `Install the Sentry Capacitor SDK as a dependency using [codeNpm:npm] or [codeYarn:yarn], alongside the Sentry Vue SDK:`,
            {
              codeYarn: <code />,
              codeNpm: <code />,
            }
          )}
        </p>
      ),
      configurations: getInstallConfig(),
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: t(
        "Initialize Sentry as early as possible in your application's lifecycle."
      ),
      configurations: getSetupConfiguration(params),
    },
    getUploadSourceMapsStep({
      guideLink: 'https://docs.sentry.io/platforms/javascript/guides/vue/sourcemaps/',
      ...params,
    }),
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t(
        "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
      ),
      configurations: [
        {
          language: 'javascript',
          code: `myUndefinedFunction();`,
        },
      ],
    },
  ],
  nextSteps: params => getNextStep(params),
};

export const nextSteps = [
  {
    id: 'vue-features',
    name: t('Vue Features'),
    description: t('Learn about our first class integration with the Vue framework.'),
    link: 'https://docs.sentry.io/platforms/javascript/guides/vue/features/',
  },
  {
    id: 'performance-monitoring',
    name: t('Performance Monitoring'),
    description: t(
      'Track down transactions to connect the dots between 10-second page loads and poor-performing API calls or slow database queries.'
    ),
    link: 'https://docs.sentry.io/platforms/javascript/guides/vue/performance/',
  },
  {
    id: 'session-replay',
    name: t('Session Replay'),
    description: t(
      'Get to the root cause of an error or latency issue faster by seeing all the technical details related to that issue in one visual replay on your web application.'
    ),
    link: 'https://docs.sentry.io/platforms/javascript/guides/vue/session-replay/',
  },
];

function getSiblingImportsSetupConfiguration(siblingOption: string): string {
  switch (siblingOption) {
    case VueVersion.VUE3:
      return `import {createApp} from "vue";
          import {createRouter} from "vue-router";`;
    case VueVersion.VUE2:
    default:
      return `import Vue from "vue";
          import Router from "vue-router";`;
  }
}

function getSiblingSuffix(siblingOption: string): string {
  switch (siblingOption) {
    case VueVersion.VUE3:
      return `app.use(router);
      app.mount("#app");`;
    case VueVersion.VUE2:
    default:
      return `new Vue({
        router,
        render: (h) => h(App),
      }).$mount("#app");`;
  }
}

function getVueConstSetup(siblingOption: string): string {
  switch (siblingOption) {
    case VueVersion.VUE3:
      return `
          const app = createApp({
            // ...
          });
          const router = createRouter({
            // ...
          });
          `;
    case VueVersion.VUE2:
      return `
          Vue.use(Router);

          const router = new Router({
            // ...
          });
          `;
    default:
      return '';
  }
}

function getSetupConfiguration(params: Params) {
  const siblingOption = params.platformOptions.siblingOption;
  const sentryInitLayout = getSentryInitLayout(params, siblingOption);
  const configuration = [
    {
      language: 'javascript',
      code: `${getSiblingImportsSetupConfiguration(siblingOption)}
          import * as Sentry from "@sentry/vue";
          ${getVueConstSetup(siblingOption)}
          ${sentryInitLayout}

          ${getSiblingSuffix(siblingOption)}`,
    },
  ];

  return configuration;
}

const replayOnboarding: OnboardingConfig<PlatformOptions> = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'You need a minimum version 7.27.0 of [code:@sentry/vue] in order to use Session Replay. You do not need to install any additional packages.',
        {
          code: <code />,
        }
      ),
      configurations: getInstallConfig(),
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: getReplayConfigureDescription({
        link: 'https://docs.sentry.io/platforms/javascript/guides/vue/session-replay/',
      }),
      configurations: getSetupConfiguration(params),
      additionalInfo: <TracePropagationMessage />,
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const feedbackOnboarding: OnboardingConfig<PlatformOptions> = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'For the User Feedback integration to work, you must have the Sentry browser SDK package, or an equivalent framework SDK (e.g. [code:@sentry/vue]) installed, minimum version 7.85.0.',
        {
          code: <code />,
        }
      ),
      configurations: getInstallConfig(),
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: getFeedbackConfigureDescription({
        linkConfig:
          'https://docs.sentry.io/platforms/javascript/guides/vue/user-feedback/configuration/',
        linkButton:
          'https://docs.sentry.io/platforms/javascript/guides/vue/user-feedback/configuration/#bring-your-own-button',
      }),
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getFeedbackSDKSetupSnippet({
                importStatement: `import * as Sentry from "@sentry/vue";`,
                dsn: params.dsn,
                feedbackOptions: params.feedbackOptions,
              }),
            },
          ],
        },
      ],
      additionalInfo: crashReportCallout({
        link: 'https://docs.sentry.io/platforms/javascript/guides/vue/user-feedback/#crash-report-modal',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const crashReportOnboarding: OnboardingConfig<PlatformOptions> = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportJavaScriptInstallStep(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getCrashReportModalConfigDescription({
        link: 'https://docs.sentry.io/platforms/javascript/guides/vue/user-feedback/configuration/#crash-report-modal',
      }),
      additionalInfo: widgetCallout({
        link: 'https://docs.sentry.io/platforms/javascript/guides/vue/user-feedback/#user-feedback-widget',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs<PlatformOptions> = {
  onboarding,
  platformOptions,
  feedbackOnboardingNpm: feedbackOnboarding,
  replayOnboardingNpm: replayOnboarding,
  customMetricsOnboarding: getJSMetricsOnboarding({getInstallConfig}),
  crashReportOnboarding,
};

export default docs;

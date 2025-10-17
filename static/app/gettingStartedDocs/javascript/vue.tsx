import {buildSdkConfig} from 'sentry/components/onboarding/gettingStartedDoc/buildSdkConfig';
import crashReportCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/crashReportCallout';
import {widgetCalloutBlock} from 'sentry/components/onboarding/gettingStartedDoc/feedback/widgetCallout';
import {tracePropagationBlock} from 'sentry/components/onboarding/gettingStartedDoc/replay/tracePropagationMessage';
import type {
  ContentBlock,
  Docs,
  DocsParams,
  OnboardingConfig,
  PlatformOption,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {
  getCrashReportJavaScriptInstallSteps,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
  getFeedbackConfigureDescription,
  getFeedbackSDKSetupSnippet,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {
  getReplayConfigOptions,
  getReplayConfigureDescription,
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {featureFlagOnboarding} from 'sentry/gettingStartedDocs/javascript/javascript';
import {t, tct} from 'sentry/locale';
import {
  getJavascriptLogsOnboarding,
  getJavascriptProfilingOnboarding,
} from 'sentry/utils/gettingStartedDocs/javascript';

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

const getIntegrations = (params: Params): string[] => {
  const integrations = [];
  if (params.isPerformanceSelected) {
    integrations.push(`Sentry.browserTracingIntegration({ router })`);
  }

  if (params.isReplaySelected) {
    integrations.push(
      `Sentry.replayIntegration(${getReplayConfigOptions(params.replayOptions)})`
    );
  }

  if (params.isProfilingSelected) {
    integrations.push(`Sentry.browserProfilingIntegration()`);
  }

  return integrations;
};

const getDynamicParts = (params: Params): string[] => {
  const dynamicParts: string[] = [];

  if (params.isPerformanceSelected) {
    dynamicParts.push(`
      // Tracing
      tracesSampleRate: 1.0, // Capture 100% of the transactions
      // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
      tracePropagationTargets: ["localhost", /^https:\\/\\/yourserver\\.io\\/api/]`);
  }

  if (params.isReplaySelected) {
    dynamicParts.push(`
      // Session Replay
      replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
      replaysOnErrorSampleRate: 1.0 // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.`);
  }

  if (params.isLogsSelected) {
    dynamicParts.push(`
      // Logs
      enableLogs: true`);
  }

  if (params.isProfilingSelected) {
    dynamicParts.push(`
      // Profiling
      profilesSampleRate: 1.0 // Profile 100% of the transactions. This value is relative to tracesSampleRate`);
  }

  return dynamicParts;
};

const getSentryInitLayout = (params: Params, siblingOption: string): string => {
  const config = buildSdkConfig({
    params,
    staticParts: [
      `${siblingOption === VueVersion.VUE2 ? 'Vue' : 'app'}`,
      `dsn: "${params.dsn.public}"`,
      `// Setting this option to true will send default PII data to Sentry.
      // For example, automatic IP address collection on events
      sendDefaultPii: true`,
    ],
    getIntegrations,
    getDynamicParts,
  });

  return `Sentry.init({
    ${config}
  });`;
};

const installSnippetBlock: ContentBlock = {
  type: 'code',
  tabs: [
    {
      label: 'npm',
      language: 'bash',
      code: 'npm install --save @sentry/vue',
    },
    {
      label: 'yarn',
      language: 'bash',
      code: 'yarn add @sentry/vue',
    },
    {
      label: 'pnpm',
      language: 'bash',
      code: 'pnpm add @sentry/vue',
    },
  ],
};

const getSetupCodeBlock = (params: Params): ContentBlock => {
  const siblingOption = params.platformOptions.siblingOption;
  const sentryInitLayout = getSentryInitLayout(params, siblingOption);
  return {
    type: 'code',
    tabs: [
      {
        label: 'JavaScript',
        language: 'javascript',
        code: `${getSiblingImportsSetupConfiguration(siblingOption)}
  import * as Sentry from "@sentry/vue";
  ${getVueConstSetup(siblingOption)}
  ${sentryInitLayout}

  ${getSiblingSuffix(siblingOption)}`,
      },
    ],
  };
};

const onboarding: OnboardingConfig<PlatformOptions> = {
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
  verify: () => [
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
              code: `myUndefinedFunction();`,
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

    return steps;
  },
};

function getSiblingImportsSetupConfiguration(siblingOption: string): string {
  switch (siblingOption) {
    case VueVersion.VUE3:
      return `import {createApp} from "vue";
          import {createRouter} from "vue-router";
          import router from "./router";
          `;
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

const replayOnboarding: OnboardingConfig<PlatformOptions> = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'You need a minimum version 7.27.0 of [code:@sentry/vue] in order to use Session Replay. You do not need to install any additional packages.',
            {
              code: <code />,
            }
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
          text: getReplayConfigureDescription({
            link: 'https://docs.sentry.io/platforms/javascript/guides/vue/session-replay/',
          }),
        },
        getSetupCodeBlock(params),
        tracePropagationBlock,
      ],
    },
  ],
  verify: getReplayVerifyStep(),
  nextSteps: () => [],
};

const feedbackOnboarding: OnboardingConfig<PlatformOptions> = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'For the User Feedback integration to work, you must have the Sentry browser SDK package, or an equivalent framework SDK (e.g. [code:@sentry/vue]) installed, minimum version 7.85.0.',
            {
              code: <code />,
            }
          ),
        },
        installSnippetBlock,
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getFeedbackConfigureDescription({
            linkConfig:
              'https://docs.sentry.io/platforms/javascript/guides/vue/user-feedback/configuration/',
            linkButton:
              'https://docs.sentry.io/platforms/javascript/guides/vue/user-feedback/configuration/#bring-your-own-button',
          }),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: getFeedbackSDKSetupSnippet({
                importStatement: `import * as Sentry from "@sentry/vue";`,
                dsn: params.dsn.public,
                feedbackOptions: params.feedbackOptions,
              }),
            },
          ],
        },
        {
          type: 'custom',
          content: crashReportCallout({
            link: 'https://docs.sentry.io/platforms/javascript/guides/vue/user-feedback/#crash-report-modal',
          }),
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const crashReportOnboarding: OnboardingConfig<PlatformOptions> = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportJavaScriptInstallSteps(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getCrashReportModalConfigDescription({
            link: 'https://docs.sentry.io/platforms/javascript/guides/vue/user-feedback/configuration/#crash-report-modal',
          }),
        },
        widgetCalloutBlock({
          link: 'https://docs.sentry.io/platforms/javascript/guides/vue/user-feedback/#user-feedback-widget',
        }),
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const profilingOnboarding = getJavascriptProfilingOnboarding({
  installSnippetBlock,
  docsLink:
    'https://docs.sentry.io/platforms/javascript/guides/vue/profiling/browser-profiling/',
});

const logsOnboarding: OnboardingConfig = getJavascriptLogsOnboarding({
  installSnippetBlock,
  docsPlatform: 'vue',
  sdkPackage: '@sentry/vue',
});

const docs: Docs<PlatformOptions> = {
  onboarding,
  platformOptions,
  feedbackOnboardingNpm: feedbackOnboarding,
  replayOnboarding,
  crashReportOnboarding,
  profilingOnboarding,
  featureFlagOnboarding,
  logsOnboarding,
};

export default docs;

import {buildSdkConfig} from 'sentry/components/onboarding/gettingStartedDoc/buildSdkConfig';
import type {
  ContentBlock,
  DocsParams,
  PlatformOption,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getFeedbackConfigOptions} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {getReplayConfigOptions} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {t} from 'sentry/locale';

export enum VueVersion {
  VUE3 = 'vue3',
  VUE2 = 'vue2',
}

type PlatformOptionKey = 'siblingOption';

export const platformOptions: Record<PlatformOptionKey, PlatformOption> = {
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

export type PlatformOptions = typeof platformOptions;
export type Params = DocsParams<PlatformOptions>;

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

  if (params.isFeedbackSelected) {
    integrations.push(`
      Sentry.feedbackIntegration({
        colorScheme: "system",
        ${getFeedbackConfigOptions(params.feedbackOptions)}
      }),`);
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
      profileSessionSampleRate: 1.0 // Profile 100% of user sessions`);
  }

  return dynamicParts;
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

function getSentryInitLayout(params: Params, siblingOption: string): string {
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
}

export function getSetupCodeBlock(params: Params): ContentBlock {
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
}

export const installSnippetBlock: ContentBlock = {
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

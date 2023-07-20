import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {PlatformKey} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types';

type StepProps = {
  newOrg: boolean;
  organization: Organization;
  platformKey: PlatformKey;
  projectId: string;
  sentryInitContent: string;
};

// Configuration Start
const replayIntegration = `
new Sentry.Replay(),
`;

const replayOtherConfig = `
// Session Replay
replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
`;

const performanceIntegration = `
new Sentry.BrowserTracing({
  // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
  tracePropagationTargets: ["localhost", "https:yourserver.io/api/"],
  routingInstrumentation:  Sentry.vueRouterInstrumentation(router),
}),
`;

const performanceOtherConfig = `
// Performance Monitoring
tracesSampleRate: 1.0, // Capture 100% of the transactions, reduce in production!
`;

export const steps = ({
  sentryInitContent,
  ...props
}: Partial<StepProps> = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: t(
      'Sentry captures data by using an SDK within your application’s runtime.'
    ),
    configurations: [
      {
        language: 'bash',
        code: `
# Using yarn
yarn add @sentry/vue

# Using npm
npm install --save @sentry/vue
        `,
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: t(
      "Initialize Sentry as early as possible in your application's lifecycle."
    ),
    configurations: [
      {
        description: <h5>V2</h5>,
        language: 'javascript',
        code: `
        import { createApp } from "vue";
        import { createRouter } from "vue-router";
        import * as Sentry from "@sentry/vue";

        const app = createApp({
          // ...
        });
        const router = createRouter({
          // ...
        });

        Sentry.init({
          app,
          ${sentryInitContent}
        });

        app.use(router);
        app.mount("#app");
        `,
      },
      {
        description: <h5>V3</h5>,
        language: 'javascript',
        code: `
        import Vue from "vue";
        import Router from "vue-router";
        import * as Sentry from "@sentry/vue";

        Vue.use(Router);

        const router = new Router({
          // ...
        });

        Sentry.init({
          Vue,
          ${sentryInitContent}
        });

        // ...

        new Vue({
          router,
          render: (h) => h(App),
        }).$mount("#app");
        `,
      },
    ],
  },
  getUploadSourceMapsStep({
    guideLink: 'https://docs.sentry.io/platforms/javascript/guides/vue/sourcemaps/',
    ...props,
  }),
  {
    type: StepType.VERIFY,
    description: t(
      "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
    ),
    configurations: [
      {
        language: 'javascript',
        code: 'myUndefinedFunction();',
      },
    ],
  },
];

export const nextSteps = [
  {
    id: 'source-maps',
    name: t('Source Maps'),
    description: t('Learn how to enable readable stack traces in your Sentry errors.'),
    link: 'https://docs.sentry.io/platforms/javascript/guides/vue/sourcemaps/',
  },
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
// Configuration End

export function GettingStartedWithVue({
  dsn,
  activeProductSelection = [],
  organization,
  newOrg,
  platformKey,
  projectId,
}: ModuleProps) {
  const integrations: string[] = [];
  const otherConfigs: string[] = [];

  let nextStepDocs = [...nextSteps];

  if (activeProductSelection.includes(ProductSolution.PERFORMANCE_MONITORING)) {
    integrations.push(performanceIntegration.trim());
    otherConfigs.push(performanceOtherConfig.trim());
    nextStepDocs = nextStepDocs.filter(
      step => step.id !== ProductSolution.PERFORMANCE_MONITORING
    );
  }

  if (activeProductSelection.includes(ProductSolution.SESSION_REPLAY)) {
    integrations.push(replayIntegration.trim());
    otherConfigs.push(replayOtherConfig.trim());
    nextStepDocs = nextStepDocs.filter(
      step => step.id !== ProductSolution.SESSION_REPLAY
    );
  }

  let sentryInitContent: string[] = [`dsn: "${dsn}",`];

  if (integrations.length > 0) {
    sentryInitContent = sentryInitContent.concat('integrations: [', integrations, '],');
  }

  if (otherConfigs.length > 0) {
    sentryInitContent = sentryInitContent.concat(otherConfigs);
  }

  return (
    <Layout
      steps={steps({
        sentryInitContent: sentryInitContent.join('\n'),
        organization,
        newOrg,
        platformKey,
        projectId,
      })}
      nextSteps={nextStepDocs}
      newOrg={newOrg}
      platformKey={platformKey}
    />
  );
}

export default GettingStartedWithVue;

import {Fragment} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import crashReportCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/crashReportCallout';
import widgetCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/widgetCallout';
import TracePropagationMessage from 'sentry/components/onboarding/gettingStartedDoc/replay/tracePropagationMessage';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportJavaScriptInstallStep,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
  getFeedbackConfigureDescription,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {getJSMetricsOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import {MaybeBrowserProfilingBetaWarning} from 'sentry/components/onboarding/gettingStartedDoc/utils/profilingOnboarding';
import {
  getReplayConfigOptions,
  getReplayConfigureDescription,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getNuxtModuleSnippet = () => `
export default defineNuxtConfig({
  modules: ["@sentry/nuxt/module"],
});
`;

const getSdkClientSetupSnippet = (params: Params) => `
import * as Sentry from "@sentry/nuxt";

Sentry.init({
  // If set up, you can use your runtime config here
  // dsn: useRuntimeConfig().public.sentry.dsn,
  dsn: "${params.dsn.public}",${
    params.isReplaySelected
      ? `
  integrations: [Sentry.replayIntegration(${getReplayConfigOptions(params.replayOptions)})],`
      : ''
  }${
    params.isPerformanceSelected
      ? `
  // Tracing
  // We recommend adjusting this value in production, or using a tracesSampler for finer control.
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
  }${
    params.isProfilingSelected
      ? `
  // Set profilesSampleRate to 1.0 to profile every transaction.
  // Since profilesSampleRate is relative to tracesSampleRate,
  // the final profiling rate can be computed as tracesSampleRate * profilesSampleRate
  // For example, a tracesSampleRate of 0.5 and profilesSampleRate of 0.5 would
  // results in 25% of transactions being profiled (0.5*0.5=0.25)
  profilesSampleRate: 1.0,`
      : ''
  }
});
`;

const getSdkServerSetupSnippet = (params: Params) => `
import * as Sentry from "@sentry/nuxt";

Sentry.init({
  dsn: "${params.dsn.public}",${
    params.isPerformanceSelected
      ? `
  // Tracing
  // We recommend adjusting this value in production, or using a tracesSampler for finer control.
  tracesSampleRate: 1.0, // Capture 100% of the transactions`
      : ''
  }${
    params.isProfilingSelected
      ? `
    // Set profilesSampleRate to 1.0 to profile every transaction.
    // Since profilesSampleRate is relative to tracesSampleRate,
    // the final profiling rate can be computed as tracesSampleRate * profilesSampleRate
    // For example, a tracesSampleRate of 0.5 and profilesSampleRate of 0.5 would
    // results in 25% of transactions being profiled (0.5*0.5=0.25)
    profilesSampleRate: 1.0,`
      : ''
  }
});
`;

const getVerifyNuxtSnippet = () => `
<script setup>
  const triggerError = () => {
    throw new Error("Nuxt Button Error");
  };
</script>

<template>
  <button id="errorBtn" @click="triggerError">Trigger Error</button>
</template>`;

const getInstallConfig = () => [
  {
    language: 'bash',
    code: [
      {
        label: 'npm',
        value: 'npm',
        language: 'bash',
        code: 'npm install --save @sentry/nuxt',
      },
      {
        label: 'yarn',
        value: 'yarn',
        language: 'bash',
        code: 'yarn add @sentry/nuxt',
      },
      {
        label: 'pnpm',
        value: 'pnpm',
        language: 'bash',
        code: `pnpm add @sentry/nuxt`,
      },
    ],
  },
];

const onboarding: OnboardingConfig = {
  introduction: params => (
    <Fragment>
      <MaybeBrowserProfilingBetaWarning {...params} />
      <p>
        {tct(
          'In this quick guide you’ll use [strong:npm], [strong:yarn] or [strong:pnpm] to set up:',
          {
            strong: <strong />,
          }
        )}
      </p>
    </Fragment>
  ),
  install: () => [
    {
      type: StepType.INSTALL,
      description: t(
        'Add the Sentry Nuxt SDK as a dependency using your preferred package manager:'
      ),
      configurations: getInstallConfig(),
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      configurations: [
        {
          description: tct(
            'Add the Sentry Nuxt module in your [code:nuxt.config.ts] file:',
            {code: <code />}
          ),
          code: [
            {
              label: 'TypeScript',
              value: 'typescript',
              language: 'typescript',
              filename: 'nuxt.config.ts',
              code: getNuxtModuleSnippet(),
            },
          ],
        },
        {
          description: tct(
            'For the client, create a [codeFile:sentry.client.config.ts] file in your project root and initialize the Sentry SDK:',
            {codeFile: <code />}
          ),
          code: [
            {
              label: 'TypeScript',
              value: 'typescript',
              language: 'typescript',
              filename: 'sentry.client.config.ts',
              code: getSdkClientSetupSnippet(params),
            },
          ],
        },
        {
          description: (
            <Fragment>
              <p>
                {tct(
                  'For the server, create a [codeFile:sentry.server.config.ts] file in your project root and initialize the Sentry SDK:',
                  {codeFile: <code />}
                )}
              </p>

              <StyledAlert type="info" showIcon>
                {tct(
                  'To complete the server-side setup, follow the [link:Sentry Nuxt docs] for guidance. Nuxt compiles your code in ESM on the server side as well, so the deployment setup can get tricky depending on where you deploy your application.',
                  {
                    link: (
                      <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nuxt/#server-side-setup" />
                    ),
                  }
                )}
              </StyledAlert>
            </Fragment>
          ),
          code: [
            {
              label: 'TypeScript',
              value: 'typescript',
              language: 'typescript',
              filename: 'sentry.server.config.ts',
              code: getSdkServerSetupSnippet(params),
            },
          ],
        },
      ],
    },
    {
      title: t('Upload Source Maps'),
      description: tct(
        'To upload source maps to Sentry, follow the [link:instructions in our documentation].',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nuxt/#add-readable-stack-traces-to-errors" />
          ),
        }
      ),
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t(
        "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
      ),
      configurations: [
        {
          code: [
            {
              label: 'Vue',
              value: 'vue',
              language: 'html',
              code: getVerifyNuxtSnippet(),
            },
          ],
        },
      ],
    },
  ],
  nextSteps: () => [
    {
      id: 'nuxt-features',
      name: t('Nuxt Features'),
      description: t('Learn about our first class integration with the Nuxt framework.'),
      link: 'https://docs.sentry.io/platforms/javascript/guides/nuxt/features/',
    },
  ],
};

const replayOnboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'You need a minimum version 8.9.1 of [code:@sentry/nuxt] in order to use Session Replay. You do not need to install any additional packages.',
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
      description: getReplayConfigureDescription({
        link: 'https://docs.sentry.io/platforms/javascript/guides/nuxt/session-replay/',
      }),
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getSdkClientSetupSnippet(params),
            },
          ],
          additionalInfo: <TracePropagationMessage />,
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const feedbackOnboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'For the User Feedback integration to work, you must have the Sentry browser SDK package, or an equivalent framework SDK (e.g. [code:@sentry/nuxt]) installed, minimum version 7.85.0.',
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
          'https://docs.sentry.io/platforms/javascript/guides/nuxt/user-feedback/configuration/',
        linkButton:
          'https://docs.sentry.io/platforms/javascript/guides/nuxt/user-feedback/configuration/#bring-your-own-button',
      }),
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getSdkClientSetupSnippet(params),
            },
          ],
        },
      ],
      additionalInfo: crashReportCallout({
        link: 'https://docs.sentry.io/platforms/nuxt/guides/nuxt/user-feedback/#crash-report-modal',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportJavaScriptInstallStep(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getCrashReportModalConfigDescription({
        link: 'https://docs.sentry.io/platforms/javascript/guides/nuxt/user-feedback/configuration/#crash-report-modal',
      }),
      additionalInfo: widgetCallout({
        link: 'https://docs.sentry.io/platforms/javascript/guides/nuxt/user-feedback/#user-feedback-widget',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const profilingOnboarding: OnboardingConfig = {
  ...onboarding,
  introduction: params => <MaybeBrowserProfilingBetaWarning {...params} />,
};

const docs: Docs = {
  onboarding,
  feedbackOnboardingNpm: feedbackOnboarding,
  replayOnboarding,
  customMetricsOnboarding: getJSMetricsOnboarding({getInstallConfig}),
  crashReportOnboarding,
  profilingOnboarding,
};

const StyledAlert = styled(Alert)`
  margin-bottom: 0;
`;

export default docs;

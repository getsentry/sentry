import {ExternalLink} from 'sentry/components/core/link';
import {CopyDsnField} from 'sentry/components/onboarding/gettingStartedDoc/copyDsnField';
import crashReportCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/crashReportCallout';
import widgetCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/widgetCallout';
import TracePropagationMessage from 'sentry/components/onboarding/gettingStartedDoc/replay/tracePropagationMessage';
import type {
  ContentBlock,
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportJavaScriptInstallStep,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
  getFeedbackConfigureDescription,
  getFeedbackSDKSetupSnippet,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {
  getReplayConfigureDescription,
  getReplaySDKSetupSnippet,
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {featureFlagOnboarding} from 'sentry/gettingStartedDocs/javascript/javascript';
import {t, tct, tctCode} from 'sentry/locale';
import {
  getJavascriptLogsFullStackOnboarding,
  getJavascriptProfilingOnboarding,
} from 'sentry/utils/gettingStartedDocs/javascript';
import {getNodeAgentMonitoringOnboarding} from 'sentry/utils/gettingStartedDocs/node';

type Params = DocsParams;

const getInstallContent = (params: Params): ContentBlock[] => [
  {
    type: 'text',
    text: tct(
      'Configure your app automatically by running the [wizardLink:Sentry wizard] in the root of your project.',
      {
        wizardLink: (
          <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nuxt/#install" />
        ),
      }
    ),
  },
  {
    type: 'code',
    language: 'bash',
    code: `npx @sentry/wizard@latest -i nuxt ${params.isSelfHosted ? '' : '--saas'}  --org ${params.organization.slug} --project ${params.project.slug}`,
  },
];

const getVerifyNuxtSnippet = () => `
<script setup>
  const triggerError = () => {
    throw new Error("Nuxt Button Error");
  };
</script>

<template>
  <button id="errorBtn" @click="triggerError">Trigger Error</button>
</template>`;

const onboarding: OnboardingConfig = {
  install: (params: Params) => [
    {
      title: t('Automatic Configuration (Recommended)'),
      content: getInstallContent(params),
    },
  ],
  configure: params => [
    {
      collapsible: true,
      title: t('Manual Configuration'),
      content: [
        {
          type: 'text',
          text: tct(
            'Alternatively, you can also set up the SDK manually, by following the [manualSetupLink:manual setup docs].',
            {
              manualSetupLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nuxt/manual-setup/" />
              ),
            }
          ),
        },
        {
          type: 'custom',
          content: <CopyDsnField params={params} />,
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: tctCode(
            'Build and run your application and visit [code:/sentry-example-page] if you have set it up. Click the button to trigger a test error.'
          ),
        },
        {
          type: 'text',
          text: t('Or, throw an error in a simple vue component.'),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Vue',
              language: 'html',
              code: getVerifyNuxtSnippet(),
            },
          ],
        },
        {
          type: 'text',
          text: t(
            'If you see an issue in your Sentry Issues, you have successfully set up Sentry.'
          ),
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
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      content: getInstallContent(params),
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getReplayConfigureDescription({
            link: 'https://docs.sentry.io/platforms/javascript/guides/nuxt/session-replay/',
          }),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: getReplaySDKSetupSnippet({
                importStatement: `import * as Sentry from "@sentry/nuxt";`,
                dsn: params.dsn.public,
                mask: params.replayOptions?.mask,
                block: params.replayOptions?.block,
              }),
            },
          ],
        },
      ],
      additionalInfo: <TracePropagationMessage />,
    },
  ],
  verify: getReplayVerifyStep(),
  nextSteps: () => [],
};

const feedbackOnboarding: OnboardingConfig = {
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'For the User Feedback integration to work, you must have the Sentry browser SDK package, or an equivalent framework SDK (e.g. [code:@sentry/nuxt]) installed, minimum version 7.85.0.',
            {
              code: <code />,
            }
          ),
        },
        ...getInstallContent(params),
      ],
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
              code: getFeedbackSDKSetupSnippet({
                importStatement: `import * as Sentry from "@sentry/nuxt";`,
                dsn: params.dsn.public,
                feedbackOptions: params.feedbackOptions,
              }),
            },
          ],
        },
      ],
      additionalInfo: crashReportCallout({
        link: 'https://docs.sentry.io/platforms/javascript/guides/nuxt/user-feedback/#crash-report-modal',
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

const profilingOnboarding = getJavascriptProfilingOnboarding({
  installSnippetBlock: {
    type: 'code',
    tabs: [
      {
        label: 'npm',
        language: 'bash',
        code: 'npm install --save @sentry/nuxt',
      },
      {
        label: 'yarn',
        language: 'bash',
        code: 'yarn add @sentry/nuxt',
      },
      {
        label: 'pnpm',
        language: 'bash',
        code: 'pnpm add @sentry/nuxt',
      },
    ],
  },
  docsLink:
    'https://docs.sentry.io/platforms/javascript/guides/nuxt/profiling/browser-profiling/',
});

const docs: Docs = {
  onboarding,
  feedbackOnboardingNpm: feedbackOnboarding,
  replayOnboarding,
  crashReportOnboarding,
  profilingOnboarding,
  featureFlagOnboarding,
  logsOnboarding: getJavascriptLogsFullStackOnboarding({
    docsPlatform: 'nuxt',
    sdkPackage: '@sentry/nuxt',
  }),
  agentMonitoringOnboarding: getNodeAgentMonitoringOnboarding({
    basePackage: 'nuxt',
    configFileName: 'sentry.server.config.ts',
  }),
};

export default docs;

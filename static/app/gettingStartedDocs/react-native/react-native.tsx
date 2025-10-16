import {ExternalLink} from 'sentry/components/core/link';
import {CopyDsnField} from 'sentry/components/onboarding/gettingStartedDoc/copyDsnField';
import type {
  ContentBlock,
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportApiIntroduction,
  getCrashReportInstallDescription,
  getFeedbackConfigOptions,
  getFeedbackConfigureMobileDescription,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {
  getReplayMobileConfigureDescription,
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {t, tct} from 'sentry/locale';

const installCodeBlock: ContentBlock = {
  type: 'code',
  tabs: [
    {
      label: 'npm',
      language: 'bash',
      code: `npm install @sentry/react-native --save`,
    },
    {
      label: 'yarn',
      language: 'bash',
      code: `yarn add @sentry/react-native`,
    },
    {
      label: 'pnpm',
      language: 'bash',
      code: `pnpm add @sentry/react-native`,
    },
  ],
};

const getConfigureSnippet = (params: DocsParams) => `
import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: "${params.dsn.public}",
  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,${
    params.isPerformanceSelected
      ? `
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
  // We recommend adjusting this value in production.
  tracesSampleRate: 1.0,`
      : ''
  }${
    params.isProfilingSelected
      ? `
  // profilesSampleRate is relative to tracesSampleRate.
  // Here, we'll capture profiles for 100% of transactions.
  profilesSampleRate: 1.0,`
      : ''
  }${
    params.isReplaySelected
      ? `
  // Record Session Replays for 10% of Sessions and 100% of Errors
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.mobileReplayIntegration()],`
      : ''
  }${
    params.isLogsSelected
      ? `
  // Enable logs to be sent to Sentry
  // Learn more at https://docs.sentry.io/platforms/react-native/logs/
  enableLogs: true,`
      : ''
  }
});`;

const getReplaySetupSnippet = (params: DocsParams) => `
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: "${params.dsn.public}",
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.mobileReplayIntegration(),
  ],
});`;

const getReplayConfigurationSnippet = () => `
Sentry.mobileReplayIntegration({
  maskAllText: true,
  maskAllImages: true,
  maskAllVectors: true,
}),`;

const getFeedbackConfigureSnippet = (params: DocsParams) => `
import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: "${params.dsn.public}",
  integrations: [
    Sentry.feedbackIntegration({
      // Additional SDK configuration goes in here, for example:
      styles: {
        submitButton: {
          backgroundColor: "#6a1b9a",
        },
      },
      namePlaceholder: "Fullname",
      ${getFeedbackConfigOptions(params.feedbackOptions)}
    }),
  ],
});
`;

const profilingOnboarding: OnboardingConfig = {
  install: () => [
    {
      title: t('Install'),
      content: [
        {
          type: 'text',
          text: t(
            'Make sure your Sentry React Native SDK version is at least 5.32.0. If you already have the SDK installed, you can update it to the latest version with:'
          ),
        },
        installCodeBlock,
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
            'Enable Tracing and Profiling by adding [code:tracesSampleRate] and [code:profilesSampleRate] to your [code:Sentry.init()] call.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: getConfigureSnippet({
            ...params,
            isProfilingSelected: true,
          }),
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
          text: t(
            'Verify that profiling is working correctly by simply using your application.'
          ),
        },
      ],
    },
  ],
};

const feedbackOnboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: t(
            "If you're using a self-hosted Sentry instance, you'll need to be on version 24.4.2 or higher in order to use the full functionality of the User Feedback feature. Lower versions may have limited functionality."
          ),
        },
        {
          type: 'text',
          text: tct(
            'To collect user feedback from inside your application, use the [code:showFeedbackWidget] method.',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: `import * as Sentry from "@sentry/react-native";

Sentry.wrap(RootComponent);
Sentry.showFeedbackWidget();`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'You may also use the [code:showFeedbackButton] and [code:hideFeedbackButton] to show and hide a button that opens the Feedback Widget.',
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
              code: `import * as Sentry from "@sentry/react-native";

Sentry.wrap(RootComponent);

Sentry.showFeedbackWidget();
Sentry.hideFeedbackButton();`,
            },
          ],
        },
      ],
    },
  ],
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getFeedbackConfigureMobileDescription({
            linkConfig:
              'https://docs.sentry.io/platforms/react-native/user-feedback/configuration/',
            linkButton:
              'https://docs.sentry.io/platforms/react-native/user-feedback/configuration/#feedback-button-customization',
          }),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: getFeedbackConfigureSnippet(params),
            },
          ],
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const onboarding: OnboardingConfig = {
  install: params => [
    {
      title: t('Automatic Configuration (Recommended)'),
      content: [
        {
          type: 'text',
          text: tct(
            'Add Sentry automatically to your app with the [wizardLink:Sentry wizard] (call this inside your project directory).',
            {
              wizardLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/react-native/#install" />
              ),
            }
          ),
        },
        {
          type: 'code',
          code: `npx @sentry/wizard@latest -i reactNative ${params.isSelfHosted ? '' : '--saas'} --org ${params.organization.slug} --project ${params.project.slug}`,
          language: 'bash',
        },
        {
          type: 'text',
          text: t(
            'The Sentry wizard will automatically patch your project with the following:'
          ),
        },
        {
          type: 'list',
          items: [
            t('Configure the SDK with your DSN'),
            t('Add source maps upload to your build process'),
            t('Add debug symbols upload to your build process'),
          ],
        },
      ],
    },
  ],
  configure: params => [
    {
      title: t('Manual Configuration'),
      collapsible: true,
      content: [
        {
          type: 'text',
          text: tct(
            'Alternatively, you can also set up the SDK manually, by following the [manualSetupLink:manual setup docs].',
            {
              manualSetupLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/react-native/manual-setup/manual-setup/" />
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
  verify: () => [],
  nextSteps: () => [
    {
      name: t('React Navigation'),
      description: t('Set up automatic instrumentation with React Navigation'),
      link: 'https://docs.sentry.io/platforms/react-native/tracing/instrumentation/react-navigation/',
    },
    {
      name: t('React Native Navigation'),
      description: t('Set up automatic instrumentation with React Native Navigation'),
      link: 'https://docs.sentry.io/platforms/react-native/tracing/instrumentation/react-native-navigation/',
    },
    {
      name: t('Expo Router'),
      description: t('Set up automatic instrumentation with Expo Router'),
      link: 'https://docs.sentry.io/platforms/react-native/tracing/instrumentation/expo-router/',
    },
  ],
};

const feedbackOnboardingCrashApi: OnboardingConfig = {
  introduction: () => getCrashReportApiIntroduction(),
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: getCrashReportInstallDescription(),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'TypeScript',
              language: 'typescript',
              code: `import * as Sentry from "@sentry/react-native";
import { UserFeedback } from "@sentry/react-native";

const sentryId = Sentry.captureMessage("My Message");
// OR: const sentryId = Sentry.lastEventId();

const userFeedback: UserFeedback = {
  event_id: sentryId,
  name: "John Doe",
  email: "john@doe.com",
  comments: "Hello World!",
};

Sentry.captureUserFeedback(userFeedback);`,
            },
          ],
        },
      ],
    },
  ],
  configure: () => [],
  verify: () => [],
  nextSteps: () => [],
};

const replayOnboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: t(
            'Make sure your Sentry React Native SDK version is at least 6.5.0. If you already have the SDK installed, you can update it to the latest version with:'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'npm',
              language: 'bash',
              code: `npm install @sentry/react-native --save`,
            },
            {
              label: 'yarn',
              language: 'bash',
              code: `yarn add @sentry/react-native`,
            },
            {
              label: 'pnpm',
              language: 'bash',
              code: `pnpm add @sentry/react-native`,
            },
          ],
        },
        {
          type: 'text',
          text: t(
            'To set up the integration, add the following to your Sentry initialization:'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: getReplaySetupSnippet(params),
            },
          ],
        },
      ],
    },
  ],
  configure: () => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getReplayMobileConfigureDescription({
            link: 'https://docs.sentry.io/platforms/react-native/session-replay/#privacy',
          }),
        },
        {
          type: 'text',
          text: t(
            'The following code is the default configuration, which masks and blocks everything.'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: getReplayConfigurationSnippet(),
            },
          ],
        },
      ],
    },
  ],
  verify: getReplayVerifyStep(),
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  feedbackOnboardingNpm: feedbackOnboarding,
  crashReportOnboarding: feedbackOnboardingCrashApi,
  replayOnboarding,
  profilingOnboarding,
};

export default docs;

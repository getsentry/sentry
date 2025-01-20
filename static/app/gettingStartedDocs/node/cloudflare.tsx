import {Fragment} from 'react';

// import crashReportCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/crashReportCallout';
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
  // getFeedbackConfigureDescription,
  // getFeedbackSDKSetupSnippet,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {getJSMetricsOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import {
  getProfilingDocumentHeaderConfigurationStep,
  MaybeBrowserProfilingBetaWarning,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/profilingOnboarding';
import {
  // getReplayConfigOptions,
  getReplayConfigureDescription,
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {featureFlagOnboarding} from 'sentry/gettingStartedDocs/javascript/javascript';
import {t, tct} from 'sentry/locale';

export enum CloudflarePlatform {
  CLOUDFLARE_PAGES = 'cloudflare-pages',
  CLOUDFLARE_WORKERS = 'cloudflare-workers',
}

type PlatformOptionKey = 'siblingOption';

const platformOptions: Record<PlatformOptionKey, PlatformOption> = {
  siblingOption: {
    label: t('Cloudflare Platform'),
    items: [
      {
        label: t('Cloudflare Pages'),
        value: CloudflarePlatform.CLOUDFLARE_PAGES,
      },
      {
        label: t('Cloudflare Workers'),
        value: CloudflarePlatform.CLOUDFLARE_WORKERS,
      },
    ],
  },
};

type PlatformOptions = typeof platformOptions;
type Params = DocsParams<PlatformOptions>;

const getSentryInitLayout = (_params: Params, siblingOption: string): string => {
  if (siblingOption === CloudflarePlatform.CLOUDFLARE_PAGES) {
    return `import * as Sentry from "@sentry/cloudflare";
      export const onRequest = [
        // Make sure Sentry is the first middleware
        Sentry.sentryPagesPlugin((context) => ({
          dsn: "https://39cee92a7ef4d3bc57dc77944b659ddb@o4508333700677712.ingest.de.sentry.io/4508333717586014",
          // Set tracesSampleRate to 1.0 to capture 100% of spans for tracing.
          // Learn more at
          // https://docs.sentry.io/platforms/javascript/configuration/options/#traces-sample-rate
          tracesSampleRate: 1.0,
        })),
        // Add more middlewares here
      ];`;
  }
  return `
    import * as Sentry from '@sentry/cloudflare';
    export default withSentry(
      env => ({
        dsn: "https://39cee92a7ef4d3bc57dc77944b659ddb@o4508333700677712.ingest.de.sentry.io/4508333717586014",
        // Set tracesSampleRate to 1.0 to capture 100% of spans for tracing.
        // Learn more at
        // https://docs.sentry.io/platforms/javascript/configuration/options/#traces-sample-rate
        tracesSampleRate: 1.0,
      }),
      {
        async fetch(request, env, ctx) {
          return new Response('Hello World!');
        },
      } satisfies ExportedHandler<Env>,
    );
    `;

  // `
  // Sentry.init({
  //   ${siblingOption === VueVersion.VUE2 ? 'Vue,' : 'app,'}
  //   dsn: "${params.dsn.public}",
  //   integrations: [${
  //     params.isPerformanceSelected
  //       ? `
  //         Sentry.browserTracingIntegration({ router }),`
  //       : ''
  //   }${
  //     params.isReplaySelected
  //       ? `
  //         Sentry.replayIntegration(${getReplayConfigOptions(params.replayOptions)}),`
  //       : ''
  //   }${
  //     params.isProfilingSelected
  //       ? `
  //         Sentry.browserProfilingIntegration(),`
  //       : ''
  //   }
  // ],${
  //   params.isPerformanceSelected
  //     ? `
  //       // Tracing
  //       tracesSampleRate: 1.0, //  Capture 100% of the transactions
  //       // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
  //       tracePropagationTargets: ["localhost", /^https:\\/\\/yourserver\\.io\\/api/],`
  //     : ''
  // }${
  //   params.isReplaySelected
  //     ? `
  //       // Session Replay
  //       replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
  //       replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.`
  //     : ''
  // }${
  //   params.isProfilingSelected
  //     ? `
  //       // Profiling
  //       profilesSampleRate: 1.0, // Profile 100% of the transactions. This value is relative to tracesSampleRate`
  //     : ''
  // }
  // });`;
};

const getInstallConfig = () => [
  {
    language: 'bash',
    code: [
      {
        label: 'npm',
        value: 'npm',
        language: 'bash',
        code: `npm install --save @sentry/cloudflare`,
      },
      {
        label: 'yarn',
        value: 'yarn',
        language: 'bash',
        code: `yarn add @sentry/cloudflare`,
      },
      {
        label: 'pnpm',
        value: 'pnpm',
        language: 'bash',
        code: `pnpm add @sentry/cloudflare`,
      },
    ],
  },
];

const onboarding: OnboardingConfig<PlatformOptions> = {
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
      description: (
        <p>
          {tct(
            `Install the Sentry Cloudflare SDK as a dependency using [code:npm] or [code:yarn], alongside the Sentry Vue SDK:`,
            {
              code: <code />,
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
      description: tct(
        "Initialize Sentry as early as possible in your application's lifecycle, usually your app's entry point ([code:main.ts/js]).",
        {code: <code />}
      ),
      configurations: getSetupConfiguration(params),
    },
    getUploadSourceMapsStep({
      guideLink:
        'https://docs.sentry.io/platforms/javascript/guides/cloudflare/sourcemaps/',
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
  nextSteps: () => [
    // {
    //   id: 'vue-features',
    //   name: t('Vue Features'),
    //   description: t('Learn about our first class integration with the Vue framework.'),
    //   link: 'https://docs.sentry.io/platforms/javascript/guides/vue/features/',
    // },
  ],
};

function getSetupConfiguration(params: Params) {
  const siblingOption = params.platformOptions.siblingOption;
  const sentryInitLayout = getSentryInitLayout(params, siblingOption);
  const configuration = [
    {
      language: 'javascript',
      code: sentryInitLayout,
    },
    ...(params.isProfilingSelected
      ? [getProfilingDocumentHeaderConfigurationStep()]
      : []),
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
  verify: getReplayVerifyStep(),
  nextSteps: () => [],
};

const crashReportOnboarding: OnboardingConfig<PlatformOptions> = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportJavaScriptInstallStep(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getCrashReportModalConfigDescription({
        link: 'https://docs.sentry.io/platforms/javascript/guides/cloudflare/user-feedback/configuration/#crash-report-modal',
      }),
      additionalInfo: widgetCallout({
        link: 'https://docs.sentry.io/platforms/javascript/guides/cloudflare/user-feedback/#user-feedback-widget',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

// const profilingOnboarding: OnboardingConfig<PlatformOptions> = {
//   ...onboarding,
//   introduction: params => <MaybeBrowserProfilingBetaWarning {...params} />,
// };

const docs: Docs<PlatformOptions> = {
  onboarding,
  platformOptions,
  replayOnboarding,
  customMetricsOnboarding: getJSMetricsOnboarding({getInstallConfig}),
  crashReportOnboarding,
  featureFlagOnboarding,
};

export default docs;

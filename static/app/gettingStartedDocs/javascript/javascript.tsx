import {css} from '@emotion/react';

import {IntegrationOptions} from 'sentry/components/events/featureFlags/utils';
import ExternalLink from 'sentry/components/links/externalLink';
import crashReportCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/crashReportCallout';
import widgetCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/widgetCallout';
import TracePropagationMessage from 'sentry/components/onboarding/gettingStartedDoc/replay/tracePropagationMessage';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  BasePlatformOptions,
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {
  getCrashReportJavaScriptInstallStep,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
  getFeedbackConfigOptions,
  getFeedbackConfigureDescription,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {
  getProfilingDocumentHeaderConfigurationStep,
  MaybeBrowserProfilingBetaWarning,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/profilingOnboarding';
import {
  getReplayConfigOptions,
  getReplayConfigureDescription,
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {updateDynamicSdkLoaderOptions} from './jsLoader/updateDynamicSdkLoaderOptions';

export enum InstallationMode {
  AUTO = 'auto',
  MANUAL = 'manual',
}

const platformOptions = {
  installationMode: {
    label: t('Installation Mode'),
    items: [
      {
        label: t('Loader Script'),
        value: InstallationMode.AUTO,
      },
      {
        label: t('Npm/Yarn'),
        value: InstallationMode.MANUAL,
      },
    ],
    defaultValue: InstallationMode.AUTO,
  },
} satisfies BasePlatformOptions;

type PlatformOptions = typeof platformOptions;
type Params = DocsParams<PlatformOptions>;
type FlagOptions = {
  importStatement: string; // feature flag SDK import
  integration: string; // what's in the integrations array
  sdkInit: string; // code to register with feature flag SDK
};

const FLAG_OPTIONS: Record<IntegrationOptions, FlagOptions> = {
  [IntegrationOptions.LAUNCHDARKLY]: {
    importStatement: `import * as LaunchDarkly from 'launchdarkly-js-client-sdk';`,
    integration: 'launchDarklyIntegration()',
    sdkInit: `const ldClient = LaunchDarkly.initialize(
    'my-client-ID',
    {kind: 'user', key: 'my-user-context-key'},
    {inspectors: [Sentry.buildLaunchDarklyFlagUsedHandler()]}
);

// Evaluates a flag
const flagVal = ldClient.variation('my-flag', false);`,
  },
  [IntegrationOptions.OPENFEATURE]: {
    importStatement: `import { OpenFeature } from '@openfeature/web-sdk';`,
    integration: 'openFeatureIntegration()',
    sdkInit: `const client = OpenFeature.getClient();
client.addHooks(new Sentry.OpenFeatureIntegrationHook());

// Evaluating flags will record the result on the Sentry client.
const result = client.getBooleanValue('my-flag', false);`,
  },
  [IntegrationOptions.UNLEASH]: {
    importStatement: `import { UnleashClient } from 'unleash-proxy-client';`,
    integration: 'unleashIntegration({unleashClientClass: UnleashClient})',
    sdkInit: `const unleash = new UnleashClient({
  url: "https://<your-unleash-instance>/api/frontend",
  clientKey: "<your-client-side-token>",
  appName: "my-webapp",
});

unleash.start();

// Evaluate a flag with a default value. You may have to wait for your client to synchronize first.
unleash.isEnabled("test-flag");

Sentry.captureException(new Error("Something went wrong!"));`,
  },
  [IntegrationOptions.GENERIC]: {
    importStatement: ``,
    integration: 'featureFlagsIntegration()',
    sdkInit: `const flagsIntegration = Sentry.getClient()?.getIntegrationByName<Sentry.FeatureFlagsIntegration>('FeatureFlags');

if (flagsIntegration) {
  flagsIntegration.addFeatureFlag('test-flag', false);
} else {
  // Something went wrong, check your DSN and/or integrations
}

Sentry.captureException(new Error('Something went wrong!'));`,
  },
};

const isAutoInstall = (params: Params) =>
  params.platformOptions.installationMode === InstallationMode.AUTO;

const getSdkSetupSnippet = (params: Params) => `
import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "${params.dsn.public}",
  integrations: [${
    params.isPerformanceSelected
      ? `
        Sentry.browserTracingIntegration(),`
      : ''
  }${
    params.isProfilingSelected
      ? `
          Sentry.browserProfilingIntegration(),`
      : ''
  }${
    params.isFeedbackSelected
      ? `
        Sentry.feedbackIntegration({
// Additional SDK configuration goes in here, for example:
colorScheme: "system",
${getFeedbackConfigOptions(params.feedbackOptions)}}),`
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
      // Tracing
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

const getVerifyJSSnippet = () => `
myUndefinedFunction();`;

const getInstallConfig = () => [
  {
    language: 'bash',
    code: [
      {
        label: 'npm',
        value: 'npm',
        language: 'bash',
        code: 'npm install --save @sentry/browser',
      },
      {
        label: 'yarn',
        value: 'yarn',
        language: 'bash',
        code: 'yarn add @sentry/browser',
      },
    ],
  },
];

const getVerifyConfig = () => [
  {
    type: StepType.VERIFY,
    description: t(
      "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
    ),
    configurations: [
      {
        code: [
          {
            label: 'Javascript',
            value: 'javascript',
            language: 'javascript',
            code: getVerifyJSSnippet(),
          },
        ],
      },
    ],
  },
];

const loaderScriptOnboarding: OnboardingConfig<PlatformOptions> = {
  introduction: () =>
    tct('In this quick guide you’ll use our [strong: Loader Script] to set up:', {
      strong: <strong />,
    }),
  install: params => [
    {
      type: StepType.INSTALL,
      description: t('Add this script tag to the top of the page:'),
      configurations: [
        {
          language: 'html',
          code: [
            {
              label: 'HTML',
              value: 'html',
              language: 'html',
              code: `
<script
  src="${params.dsn.cdn}"
  crossorigin="anonymous"
></script>`,
            },
          ],
        },
      ],
    },
  ],
  configure: params => [
    {
      title: t('Configure SDK (Optional)'),
      description: t(
        "Initialize Sentry as early as possible in your application's lifecycle."
      ),
      collapsible: true,
      configurations: [
        {
          language: 'html',
          code: [
            {
              label: 'HTML',
              value: 'html',
              language: 'html',
              code: `
<script>
  Sentry.onLoad(function() {
    Sentry.init({${
      !(params.isPerformanceSelected || params.isReplaySelected)
        ? `
        // You can add any additional configuration here`
        : ''
    }${
      params.isPerformanceSelected
        ? `
        // Tracing
        tracesSampleRate: 1.0, // Capture 100% of the transactions`
        : ''
    }${
      params.isReplaySelected
        ? `
        // Session Replay
        replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
        replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.`
        : ''
    }
      });
  });
</script>`,
            },
          ],
        },
      ],
      onOptionalToggleClick: showOptionalConfig => {
        if (showOptionalConfig) {
          trackAnalytics('onboarding.js_loader_npm_docs_optional_shown', {
            organization: params.organization,
            platform: params.platformKey,
            project_id: params.projectId,
          });
        }
      },
    },
  ],
  verify: getVerifyConfig,
  nextSteps: () => [
    {
      id: 'source-maps',
      name: t('Source Maps'),
      description: t('Learn how to enable readable stack traces in your Sentry errors.'),
      link: 'https://docs.sentry.io/platforms/javascript/sourcemaps/',
    },
  ],
  onPageLoad: params => {
    return () => {
      trackAnalytics('onboarding.setup_loader_docs_rendered', {
        organization: params.organization,
        platform: params.platformKey,
        project_id: params.projectId,
      });
    };
  },
  onPlatformOptionsChange: params => {
    return () => {
      trackAnalytics('onboarding.js_loader_npm_docs_shown', {
        organization: params.organization,
        platform: params.platformKey,
        project_id: params.projectId,
      });
    };
  },
  onProductSelectionChange: params => {
    return products => {
      updateDynamicSdkLoaderOptions({
        orgSlug: params.organization.slug,
        projectSlug: params.projectSlug,
        products,
        projectKey: params.projectKeyId,
        api: params.api,
      });
    };
  },
  onProductSelectionLoad: params => {
    return products => {
      updateDynamicSdkLoaderOptions({
        orgSlug: params.organization.slug,
        projectSlug: params.projectSlug,
        products,
        projectKey: params.projectKeyId,
        api: params.api,
      });
    };
  },
};

const packageManagerOnboarding: OnboardingConfig<PlatformOptions> = {
  introduction: () =>
    tct('In this quick guide you’ll use [strong:npm] or [strong:yarn] to set up:', {
      strong: <strong />,
    }),
  install: () => [
    {
      type: StepType.INSTALL,
      description: t(
        'Sentry captures data by using an SDK within your application’s runtime.'
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
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getSdkSetupSnippet(params),
            },
          ],
        },
        ...(params.isProfilingSelected
          ? [getProfilingDocumentHeaderConfigurationStep()]
          : []),
      ],
    },
    getUploadSourceMapsStep({
      guideLink: 'https://docs.sentry.io/platforms/javascript/sourcemaps/',
      ...params,
    }),
  ],
  verify: getVerifyConfig,
  nextSteps: () => [],
  onPageLoad: params => {
    return () => {
      trackAnalytics('onboarding.js_loader_npm_docs_shown', {
        organization: params.organization,
        platform: params.platformKey,
        project_id: params.projectId,
      });
    };
  },
  onPlatformOptionsChange: params => {
    return () => {
      trackAnalytics('onboarding.setup_loader_docs_rendered', {
        organization: params.organization,
        platform: params.platformKey,
        project_id: params.projectId,
      });
    };
  },
};

const onboarding: OnboardingConfig<PlatformOptions> = {
  introduction: params => (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        gap: ${space(1)};
      `}
    >
      <MaybeBrowserProfilingBetaWarning {...params} />
      <TextBlock noMargin>
        {isAutoInstall(params)
          ? loaderScriptOnboarding.introduction?.(params)
          : packageManagerOnboarding.introduction?.(params)}
      </TextBlock>
    </div>
  ),
  install: params =>
    isAutoInstall(params)
      ? loaderScriptOnboarding.install(params)
      : packageManagerOnboarding.install(params),
  configure: (params: Params) =>
    isAutoInstall(params)
      ? loaderScriptOnboarding.configure(params)
      : packageManagerOnboarding.configure(params),
  verify: params =>
    isAutoInstall(params)
      ? loaderScriptOnboarding.verify(params)
      : packageManagerOnboarding.verify(params),
  nextSteps: params =>
    isAutoInstall(params)
      ? loaderScriptOnboarding.nextSteps?.(params)
      : packageManagerOnboarding.nextSteps?.(params),
  onPageLoad: params =>
    isAutoInstall(params)
      ? loaderScriptOnboarding.onPageLoad?.(params)
      : packageManagerOnboarding.onPageLoad?.(params),
  onProductSelectionChange: params =>
    isAutoInstall(params)
      ? loaderScriptOnboarding.onProductSelectionChange?.(params)
      : packageManagerOnboarding.onProductSelectionChange?.(params),
  onPlatformOptionsChange: params =>
    isAutoInstall(params)
      ? loaderScriptOnboarding.onPlatformOptionsChange?.(params)
      : packageManagerOnboarding.onPlatformOptionsChange?.(params),
  onProductSelectionLoad: params =>
    isAutoInstall(params)
      ? loaderScriptOnboarding.onProductSelectionLoad?.(params)
      : packageManagerOnboarding.onProductSelectionLoad?.(params),
};

const replayOnboarding: OnboardingConfig<PlatformOptions> = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'For the Session Replay to work, you must have the Sentry browser SDK package, or an equivalent framework SDK (e.g. [code:@sentry/react]) installed, minimum version 7.27.0.',
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
        link: 'https://docs.sentry.io/platforms/javascript/session-replay/',
      }),
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getSdkSetupSnippet(params),
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

const feedbackOnboarding: OnboardingConfig<PlatformOptions> = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'For the User Feedback integration to work, you must have the Sentry browser SDK package, or an equivalent framework SDK (e.g. [code:@sentry/react]) installed, minimum version 7.85.0.',
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
          'https://docs.sentry.io/platforms/javascript/user-feedback/configuration/',
        linkButton:
          'https://docs.sentry.io/platforms/javascript/user-feedback/configuration/#bring-your-own-button',
      }),
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getSdkSetupSnippet(params),
            },
          ],
        },
      ],
      additionalInfo: crashReportCallout({
        link: 'https://docs.sentry.io/platforms/javascript/user-feedback/#crash-report-modal',
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
        link: 'https://docs.sentry.io/platforms/javascript/user-feedback/configuration/#crash-report-modal',
      }),
      additionalInfo: widgetCallout({
        link: 'https://docs.sentry.io/platforms/javascript/user-feedback/#user-feedback-widget',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const performanceOnboarding: OnboardingConfig<PlatformOptions> = {
  introduction: () =>
    t(
      "Adding Performance to your Browser JavaScript project is simple. Make sure you've got these basics down."
    ),
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Install our JavaScript browser SDK using either [code:yarn] or [code:npm]:',
        {code: <code />}
      ),
      configurations: getInstallConfig(),
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: t(
        "Configuration should happen as early as possible in your application's lifecycle."
      ),
      configurations: [
        {
          language: 'javascript',
          code: `
import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "${params.dsn.public}",
  integrations: [Sentry.browserTracingIntegration()],

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
  // Set \`tracePropagationTargets\` to control for which URLs distributed tracing should be enabled
  tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],
});
`,
          additionalInfo: tct(
            'We recommend adjusting the value of [code:tracesSampleRate] in production. Learn more about tracing [linkTracingOptions:options], how to use the [linkTracesSampler:traces_sampler] function, or how to [linkSampleTransactions:sample transactions].',
            {
              code: <code />,
              linkTracingOptions: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/configuration/options/#tracing-options" />
              ),
              linkTracesSampler: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/configuration/sampling/" />
              ),
              linkSampleTransactions: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/configuration/sampling/" />
              ),
            }
          ),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: tct(
        'Verify that performance monitoring is working correctly with our [link:automatic instrumentation] by simply using your JavaScript application.',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/tracing/instrumentation/automatic-instrumentation/" />
          ),
        }
      ),
      configurations: [
        {
          description: tct(
            'You have the option to manually construct a transaction using [link:custom instrumentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/tracing/instrumentation/custom-instrumentation/" />
              ),
            }
          ),
          language: 'javascript',
          code: `
const transaction = Sentry.startTransaction({ name: "test-transaction" });
const span = transaction.startChild({ op: "functionX" }); // This function returns a Span
// exampleFunctionCall();
span.finish(); // Remember that only finished spans will be sent with the transaction
transaction.finish(); // Finishing the transaction will send it to Sentry`,
        },
      ],
    },
  ],
  nextSteps: () => [],
};

const profilingOnboarding: OnboardingConfig<PlatformOptions> = {
  ...onboarding,
  introduction: params => <MaybeBrowserProfilingBetaWarning {...params} />,
};

export const featureFlagOnboarding: OnboardingConfig = {
  install: () => [],
  configure: ({featureFlagOptions = {integration: ''}, dsn}) => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'Add [name] to your integrations list, and then register with your feature flag SDK.',
        {
          name: (
            <code>{`${FLAG_OPTIONS[featureFlagOptions.integration as keyof typeof FLAG_OPTIONS].integration}`}</code>
          ),
        }
      ),
      configurations: [
        {
          language: 'JavaScript',
          code: `
${FLAG_OPTIONS[featureFlagOptions.integration as keyof typeof FLAG_OPTIONS].importStatement}

// Register with Sentry
Sentry.init({
  dsn: "${dsn.public}",
  integrations: [
    Sentry.${FLAG_OPTIONS[featureFlagOptions.integration as keyof typeof FLAG_OPTIONS].integration},
  ],
});

// Register with your feature flag SDK
${FLAG_OPTIONS[featureFlagOptions.integration as keyof typeof FLAG_OPTIONS].sdkInit}
`,
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs<PlatformOptions> = {
  onboarding,
  feedbackOnboardingNpm: feedbackOnboarding,
  feedbackOnboardingJsLoader,
  replayOnboarding,
  replayOnboardingJsLoader,
  performanceOnboarding,
  crashReportOnboarding,
  platformOptions,
  profilingOnboarding,
  featureFlagOnboarding,
};

export default docs;

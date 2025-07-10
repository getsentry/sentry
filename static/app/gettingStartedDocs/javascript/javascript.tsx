import {Fragment} from 'react';
import {css} from '@emotion/react';

import {Link} from 'sentry/components/core/link';
import {SdkProviderEnum as FeatureFlagProviderEnum} from 'sentry/components/events/featureFlags/utils';
import ExternalLink from 'sentry/components/links/externalLink';
import {buildSdkConfig} from 'sentry/components/onboarding/gettingStartedDoc/buildSdkConfig';
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
import {
  getAIRulesForCodeEditorStep,
  getUploadSourceMapsStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils';
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
import {getJavascriptProfilingOnboarding} from 'sentry/utils/gettingStartedDocs/javascript';
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

type FeatureFlagConfiguration = {
  integrationName: string;
  makeConfigureCode: (dsn: string) => string;
  makeVerifyCode: () => string;
  packageName: string;
};

const FEATURE_FLAG_CONFIGURATION_MAP: Record<
  FeatureFlagProviderEnum,
  FeatureFlagConfiguration
> = {
  [FeatureFlagProviderEnum.GENERIC]: {
    integrationName: `featureFlagsIntegration`,
    packageName: '',
    makeConfigureCode: (dsn: string) => `import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "${dsn}",
  integrations: [Sentry.featureFlagsIntegration()],
});`,
    makeVerifyCode:
      () => `const flagsIntegration = Sentry.getClient()?.getIntegrationByName<Sentry.FeatureFlagsIntegration>("FeatureFlags");
if (flagsIntegration) {
  flagsIntegration.addFeatureFlag("test-flag", false);
} else {
  // Something went wrong, check your DSN and/or integrations
}
Sentry.captureException(new Error("Something went wrong!"));`,
  },

  [FeatureFlagProviderEnum.LAUNCHDARKLY]: {
    integrationName: `launchDarklyIntegration`,
    packageName: 'launchdarkly-js-client-sdk',
    makeConfigureCode: (dsn: string) => `import * as Sentry from "@sentry/browser";
import * as LaunchDarkly from "launchdarkly-js-client-sdk";

Sentry.init({
  dsn: "${dsn}",
  integrations: [Sentry.launchDarklyIntegration()],
});

const ldClient = LaunchDarkly.initialize(
  "my-client-ID",
  { kind: "user", key: "my-user-context-key" },
  { inspectors: [Sentry.buildLaunchDarklyFlagUsedHandler()] },
);`,

    makeVerifyCode: () => `// You may have to wait for your client to initialize first.
ldClient?.variation("test-flag", false);
Sentry.captureException(new Error("Something went wrong!"));`,
  },

  [FeatureFlagProviderEnum.OPENFEATURE]: {
    integrationName: `openFeatureIntegration`,
    packageName: '@openfeature/web-sdk',
    makeConfigureCode: (dsn: string) => `import * as Sentry from "@sentry/browser";
import { OpenFeature } from "@openfeature/web-sdk";

Sentry.init({
  dsn: "${dsn}",
  integrations: [Sentry.openFeatureIntegration()],
});

OpenFeature.setProvider(new MyProviderOfChoice());
OpenFeature.addHooks(new Sentry.OpenFeatureIntegrationHook());`,

    makeVerifyCode: () => `const client = OpenFeature.getClient();
const result = client.getBooleanValue("test-flag", false);
Sentry.captureException(new Error("Something went wrong!"));`,
  },

  [FeatureFlagProviderEnum.STATSIG]: {
    integrationName: `statsigIntegration`,
    packageName: '@statsig/js-client',
    makeConfigureCode: (dsn: string) => `import * as Sentry from "@sentry/browser";
import { StatsigClient } from "@statsig/js-client";

const statsigClient = new StatsigClient(
  YOUR_SDK_KEY,
  { userID: "my-user-id" },
  {},
); // see Statsig SDK reference.

Sentry.init({
  dsn: "${dsn}",
  integrations: [
    Sentry.statsigIntegration({ featureFlagClient: statsigClient }),
  ],
});`,

    makeVerifyCode:
      () => `await statsigClient.initializeAsync(); // or statsigClient.initializeSync();

const result = statsigClient.checkGate("my-feature-gate");
Sentry.captureException(new Error("something went wrong"));`,
  },

  [FeatureFlagProviderEnum.UNLEASH]: {
    integrationName: `unleashIntegration`,
    packageName: 'unleash-proxy-client',
    makeConfigureCode: (dsn: string) => `import * as Sentry from "@sentry/browser";
import { UnleashClient } from "unleash-proxy-client";

Sentry.init({
  dsn: "${dsn}",
  integrations: [
    Sentry.unleashIntegration({ featureFlagClientClass: UnleashClient }),
  ],
});

const unleash = new UnleashClient({
  url: "https://<your-unleash-instance>/api/frontend",
  clientKey: "<your-client-side-token>",
  appName: "my-webapp",
});

unleash.start();`,

    makeVerifyCode: () => `// You may have to wait for your client to synchronize first.
unleash.isEnabled("test-flag");
Sentry.captureException(new Error("Something went wrong!"));`,
  },
};

const isAutoInstall = (params: Params) =>
  params.platformOptions.installationMode === InstallationMode.AUTO;

const getIntegrations = (params: Params): string[] => {
  const integrations = [];
  if (params.isPerformanceSelected) {
    integrations.push(`Sentry.browserTracingIntegration()`);
  }

  if (params.isProfilingSelected) {
    integrations.push(`Sentry.browserProfilingIntegration()`);
  }

  if (params.isReplaySelected) {
    integrations.push(
      `Sentry.replayIntegration(${getReplayConfigOptions(params.replayOptions)})`
    );
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
      tracesSampleRate: 1.0, //  Capture 100% of the transactions
      // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
      tracePropagationTargets: ["localhost", /^https:\\/\\/yourserver\\.io\\/api/]`);
  }

  if (params.isReplaySelected) {
    dynamicParts.push(`
      // Session Replay
      replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
      replaysOnErrorSampleRate: 1.0 // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.`);
  }

  if (params.isProfilingSelected) {
    dynamicParts.push(`
        // Set profilesSampleRate to 1.0 to profile every transaction.
        // Since profilesSampleRate is relative to tracesSampleRate,
        // the final profiling rate can be computed as tracesSampleRate * profilesSampleRate
        // For example, a tracesSampleRate of 0.5 and profilesSampleRate of 0.5 would
        // results in 25% of transactions being profiled (0.5*0.5=0.25)
        profilesSampleRate: 1.0`);
  }

  return dynamicParts;
};

const getSdkSetupSnippet = (params: Params) => {
  const config = buildSdkConfig({
    params,
    staticParts: [
      `dsn: "${params.dsn.public}"`,
      `// Setting this option to true will send default PII data to Sentry.
      // For example, automatic IP address collection on events
      sendDefaultPii: true`,
    ],
    getIntegrations,
    getDynamicParts,
  });

  return `
import * as Sentry from "@sentry/browser";

Sentry.init({
  ${config}
});
`;
};

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
      {
        label: 'pnpm',
        value: 'pnpm',
        language: 'bash',
        code: 'pnpm add @sentry/browser',
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

const getAiRulesConfig = (params: Params) =>
  getAIRulesForCodeEditorStep({
    rules: `
These examples should be used as guidance when configuring Sentry functionality within a project.

# Error / Exception Tracking

Use \`Sentry.captureException(error)\` to capture an exception and log the error in Sentry.
Use this in try catch blocks or areas where exceptions are expected

# Tracing Examples

Spans should be created for meaningful actions within an applications like button clicks, API calls, and function calls
Use the \`Sentry.startSpan\` function to create a span
Child spans can exist within a parent span

## Custom Span instrumentation in component actions

Name custom spans with meaningful names and operations.
Attach attributes based on relevant information and metrics from the request

\`\`\`javascript
function TestComponent() {
  const handleTestButtonClick = () => {
    // Create a transaction/span to measure performance
    Sentry.startSpan(
      {
        op: "ui.click",
        name: "Test Button Click",
      },
      (span) => {
        const value = "some config";
        const metric = "some metric";

        // Metrics can be added to the span
        span.setAttribute("config", value);
        span.setAttribute("metric", metric);

        doSomething();
      },
    );
  };

  return (
    <button type="button" onClick={handleTestButtonClick}>
      Test Sentry
    </button>
  );
}
\`\`\`

## Custom span instrumentation in API calls

Name custom spans with meaningful names and operations.
Attach attributes based on relevant information and metrics from the request

\`\`\`javascript
async function fetchUserData(userId) {
  return Sentry.startSpan(
    {
      op: "http.client",
      name: \`GET /api/users/\${userId}\`,
    },
    async () => {
      const response = await fetch(\`/api/users/\${userId}\`);
      const data = await response.json();
      return data;
    },
  );
}
\`\`\`

# Logs

Where logs are used, ensure Sentry is imported using \`import * as Sentry from "@sentry/browser"\`
Enable logging in Sentry using \`Sentry.init({ _experiments: { enableLogs: true } })\`
Reference the logger using \`const { logger } = Sentry\`
Sentry offers a \`consoleLoggingIntegration\` that can be used to log specific console error types automatically without instrumenting the individual logger calls

## Configuration

### Baseline

\`\`\`javascript
import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "${params.dsn.public}",

  _experiments: {
    enableLogs: true,
  },
});
\`\`\`

### Logger Integration

\`\`\`javascript
Sentry.init({
  dsn: "${params.dsn.public}",
  integrations: [
    // send console.log, console.error, and console.warn calls as logs to Sentry
    Sentry.consoleLoggingIntegration({ levels: ["log", "error", "warn"] }),
  ],
});
\`\`\`

## Logger Examples

\`logger.fmt\` is a template literal function that should be used to bring variables into the structured logs.

\`\`\`javascript
import * as Sentry from "@sentry/browser";

const { logger } = Sentry;

logger.trace("Starting database connection", { database: "users" });
logger.debug(logger.fmt\`Cache miss for user: \${userId}\`);
logger.info("Updated profile", { profileId: 345 });
logger.warn("Rate limit reached for endpoint", {
  endpoint: "/api/results/",
  isEnterprise: false,
});
logger.error("Failed to process payment", {
  orderId: "order_123",
  amount: 99.99,
});
logger.fatal("Database connection pool exhausted", {
  database: "users",
  activeConnections: 100,
});
\`\`\`
`,
  });

const loaderScriptOnboarding: OnboardingConfig<PlatformOptions> = {
  introduction: () =>
    tct("In this quick guide you'll use our [strong: Loader Script] to set up:", {
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
      additionalInfo: (
        <Fragment>
          <h5>{t('Default Configuration')}</h5>
          <p>
            {t(
              'The Loader Script settings are automatically updated based on the product selection above. Toggling products will dynamically configure the SDK defaults.'
            )}
          </p>
          <p>
            {tct(
              'For Tracing, the SDK is initialized with [code:tracesSampleRate: 1], meaning all traces will be captured.',
              {
                code: <code />,
              }
            )}
          </p>
          <p>
            {tct(
              'For Session Replay, the default rates are [code:replaysSessionSampleRate: 0.1] and [code:replaysOnErrorSampleRate: 1]. This captures 10% of regular sessions and 100% of sessions with an error.',
              {
                code: <code />,
              }
            )}
          </p>
          <p>
            {tct('You can review or change these settings in [link:Project Settings].', {
              link: (
                <Link
                  to={`/settings/${params.organization.slug}/projects/${params.projectSlug}/loader-script/`}
                />
              ),
            })}
          </p>
        </Fragment>
      ),
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
      params.isPerformanceSelected || params.isReplaySelected
        ? ''
        : `
        // You can add any additional configuration here`
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
    getAiRulesConfig(params),
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
    return ({previousProducts, products}) => {
      updateDynamicSdkLoaderOptions({
        orgSlug: params.organization.slug,
        projectSlug: params.projectSlug,
        products,
        previousProducts,
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
    tct(
      "In this quick guide you'll use [strong:npm], [strong:yarn], or [strong:pnpm] to set up:",
      {
        strong: <strong />,
      }
    ),
  install: () => [
    {
      type: StepType.INSTALL,
      description: t(
        "Sentry captures data by using an SDK within your application's runtime."
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
    getAiRulesConfig(params),
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
  onProductSelectionChange: params => {
    return ({products}) => {
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
      configurations: [
        {
          language: 'javascript',
          description: t(
            "Configuration should happen as early as possible in your application's lifecycle."
          ),
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
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});
`,
          additionalInfo: tct(
            'We recommend adjusting the value of [code:tracesSampleRate] in production. Learn more about tracing [linkTracingOptions:options], how to use the [linkTracesSampler:traces_sampler] function, or how to do [linkSampleTransactions:sampling].',
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
        {
          language: 'javascript',
          description: tct(
            "If you're using the current version of our JavaScript SDK and have enabled the [code: BrowserTracing] integration, distributed tracing will work out of the box. To get around possible [link:Browser CORS] issues, define your [code:tracePropagationTargets].",
            {
              code: <code />,
              link: (
                <ExternalLink href="https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS" />
              ),
            }
          ),
          code: `
Sentry.init({
  dsn: "${params.dsn.public}",
  integrations: [Sentry.browserTracingIntegration()],
  tracePropagationTargets: ["localhost", /^https:\\/\\/yourserver\\.io\\/api/],
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});
`,
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
    },
  ],
  nextSteps: () => [],
};

const profilingOnboarding = getJavascriptProfilingOnboarding({
  getInstallConfig,
  docsLink: 'https://docs.sentry.io/platforms/javascript/profiling/browser-profiling/',
});

export const featureFlagOnboarding: OnboardingConfig = {
  install: () => [],
  configure: ({featureFlagOptions = {integration: ''}, dsn}) => {
    const {integrationName, makeConfigureCode, makeVerifyCode, packageName} =
      FEATURE_FLAG_CONFIGURATION_MAP[
        featureFlagOptions.integration as keyof typeof FEATURE_FLAG_CONFIGURATION_MAP
      ];

    const installConfig = [
      {
        language: 'bash',
        code: [
          {
            label: 'npm',
            value: 'npm',
            language: 'bash',
            code: `npm install --save @sentry/browser ${packageName}`,
          },
          {
            label: 'yarn',
            value: 'yarn',
            language: 'bash',
            code: `yarn add @sentry/browser ${packageName}`,
          },
          {
            label: 'pnpm',
            value: 'pnpm',
            language: 'bash',
            code: `pnpm add @sentry/browser ${packageName}`,
          },
        ],
      },
    ];

    return [
      {
        type: StepType.INSTALL,
        description: t('Install Sentry and the selected feature flag SDK.'),
        configurations: installConfig,
      },
      {
        type: StepType.CONFIGURE,
        description: tct(
          'Add [name] to your integrations list, and initialize your feature flag SDK.',
          {
            name: <code>{integrationName}</code>,
          }
        ),
        configurations: [
          {
            language: 'JavaScript',
            code: makeConfigureCode(dsn.public),
          },
        ],
      },
      {
        type: StepType.VERIFY,
        description: t(
          'Test your setup by evaluating a flag, then capturing an exception. Check the Feature Flags table in Issue Details to confirm that your error event has recorded the flag and its result.'
        ),
        configurations: [
          {
            language: 'JavaScript',
            code: makeVerifyCode(),
          },
        ],
      },
    ];
  },
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

import {Link} from '@sentry/scraps/link';

import {buildSdkConfig} from 'sentry/components/onboarding/gettingStartedDoc/buildSdkConfig';
import {
  StepType,
  type BasePlatformOptions,
  type ContentBlock,
  type DocsParams,
  type OnboardingConfig,
  type OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getAISetupStep,
  getUploadSourceMapsStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {getFeedbackConfigOptions} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {getReplayConfigOptions} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {updateDynamicSdkLoaderOptions} from 'sentry/gettingStartedDocs/javascript/updateDynamicSdkLoaderOptions';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';

export enum InstallationMode {
  AUTO = 'auto',
  MANUAL = 'manual',
}

export const platformOptions = {
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

export type PlatformOptions = typeof platformOptions;
export type Params = DocsParams<PlatformOptions>;

export const isAutoInstall = (params: Params) =>
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
        // Set profileSessionSampleRate to 1.0 to profile during every session.
        // The decision, whether to profile or not, is made once per session (when the SDK is initialized).
        profileSessionSampleRate: 1.0`);
  }

  return dynamicParts;
};

export const getSdkSetupSnippet = (params: Params) => {
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

export const installSnippetBlock: ContentBlock = {
  type: 'code',
  tabs: [
    {
      label: 'npm',
      language: 'bash',
      code: 'npm install --save @sentry/browser',
    },
    {
      label: 'yarn',
      language: 'bash',
      code: 'yarn add @sentry/browser',
    },
    {
      label: 'pnpm',
      language: 'bash',
      code: 'pnpm add @sentry/browser',
    },
  ],
};

const getVerifyJSSnippet = (params: Params) => {
  const metricsCode = params.isMetricsSelected
    ? `  // Send a test metric before calling undefined function
  Sentry.metrics.count('test_counter', 1);
`
    : '';

  return `${metricsCode}myUndefinedFunction();`;
};

const getVerifySnippetBlock = (params: Params): ContentBlock[] => [
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
        label: 'Javascript',
        language: 'javascript',
        code: getVerifyJSSnippet(params),
      },
    ],
  },
];

export const getAiSetupConfig = (): OnboardingStep =>
  getAISetupStep({skillPath: 'sentry-sdk-setup'});

const getVerifyConfig = (params: Params) => [
  {
    type: StepType.VERIFY,
    content: getVerifySnippetBlock(params),
  },
];

export const loaderScriptOnboarding: OnboardingConfig<PlatformOptions> = {
  introduction: () =>
    tct("In this quick guide you'll use our [strong: Loader Script] to set up:", {
      strong: <strong />,
    }),
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: t('Add this script tag to the top of the page:'),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'HTML',
              language: 'html',
              code: `
<script
  src="${params.dsn.cdn}"
  crossorigin="anonymous"
></script>`,
            },
          ],
        },
        {
          type: 'subheader',
          text: t('Default Configuration'),
        },
        {
          type: 'text',
          text: t(
            'The Loader Script settings are automatically updated based on the product selection above. Toggling products will dynamically configure the SDK defaults.'
          ),
        },
        {
          type: 'list',
          items: [
            tct(
              'For Tracing, the SDK is initialized with [code:tracesSampleRate: 1], meaning all traces will be captured.',
              {
                code: <code />,
              }
            ),
            tct(
              'For Session Replay, the default rates are [code:replaysSessionSampleRate: 0.1] and [code:replaysOnErrorSampleRate: 1]. This captures 10% of regular sessions and 100% of sessions with an error.',
              {
                code: <code />,
              }
            ),
          ],
        },
        {
          type: 'text',
          text: tct(
            'You can review or change these settings in [link:Project Settings].',
            {
              link: (
                <Link
                  to={`/settings/${params.organization.slug}/projects/${params.project.slug}/loader-script/`}
                />
              ),
            }
          ),
        },
      ],
    },
  ],
  configure: params => [
    {
      title: t('Configure SDK (Optional)'),
      collapsible: true,
      content: [
        {
          type: 'text',
          text: t(
            "Initialize Sentry as early as possible in your application's lifecycle."
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'HTML',
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
            project_id: params.project.id,
          });
        }
      },
    },
    getAiSetupConfig(),
  ],
  verify: (params: Params) => getVerifyConfig(params),
  nextSteps: (params: Params) => {
    const steps = [
      {
        id: 'source-maps',
        name: t('Source Maps'),
        description: t(
          'Learn how to enable readable stack traces in your Sentry errors.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/sourcemaps/',
      },
    ];

    if (params.isMetricsSelected) {
      steps.push({
        id: 'metrics',
        name: t('Metrics'),
        description: t(
          'Learn how to track custom metrics to monitor your application performance and business KPIs.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/metrics/',
      });
    }

    return steps;
  },
  onPageLoad: params => {
    return () => {
      trackAnalytics('onboarding.setup_loader_docs_rendered', {
        organization: params.organization,
        platform: params.platformKey,
        project_id: params.project.id,
      });
    };
  },
  onPlatformOptionsChange: params => {
    return () => {
      trackAnalytics('onboarding.js_loader_npm_docs_shown', {
        organization: params.organization,
        platform: params.platformKey,
        project_id: params.project.id,
      });
    };
  },
  onProductSelectionChange: params => {
    return ({previousProducts, products}) => {
      updateDynamicSdkLoaderOptions({
        orgSlug: params.organization.slug,
        projectSlug: params.project.slug,
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
        projectSlug: params.project.slug,
        products,
        projectKey: params.projectKeyId,
        api: params.api,
      });
    };
  },
};

export const packageManagerOnboarding: OnboardingConfig<PlatformOptions> = {
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
          text: t(
            "Sentry captures data by using an SDK within your application's runtime."
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
          text: t(
            "Initialize Sentry as early as possible in your application's lifecycle."
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: getSdkSetupSnippet(params),
            },
          ],
        },
      ],
    },
    getUploadSourceMapsStep({
      guideLink: 'https://docs.sentry.io/platforms/javascript/sourcemaps/',
      ...params,
    }),
    getAiSetupConfig(),
  ],
  verify: (params: Params) => getVerifyConfig(params),
  nextSteps: (params: Params) => {
    const steps = [];

    if (params.isMetricsSelected) {
      steps.push({
        id: 'metrics',
        name: t('Metrics'),
        description: t(
          'Learn how to track custom metrics to monitor your application performance and business KPIs.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/metrics/',
      });
    }

    return steps;
  },
  onPageLoad: params => {
    return () => {
      trackAnalytics('onboarding.js_loader_npm_docs_shown', {
        organization: params.organization,
        platform: params.platformKey,
        project_id: params.project.id,
      });
    };
  },
  onProductSelectionChange: params => {
    return ({products}) => {
      updateDynamicSdkLoaderOptions({
        orgSlug: params.organization.slug,
        projectSlug: params.project.slug,
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
        projectSlug: params.project.slug,
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
        project_id: params.project.id,
      });
    };
  },
};

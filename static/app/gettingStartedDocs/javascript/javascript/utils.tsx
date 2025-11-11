import {Link} from '@sentry/scraps/link/link';

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
  getAIRulesForCodeEditorStep,
  getUploadSourceMapsStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {getFeedbackConfigOptions} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {getReplayConfigOptions} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {updateDynamicSdkLoaderOptions} from 'sentry/gettingStartedDocs/javascript/jsLoader/updateDynamicSdkLoaderOptions';
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
        // Set profilesSampleRate to 1.0 to profile every transaction.
        // Since profilesSampleRate is relative to tracesSampleRate,
        // the final profiling rate can be computed as tracesSampleRate * profilesSampleRate
        // For example, a tracesSampleRate of 0.5 and profilesSampleRate of 0.5 would
        // results in 25% of transactions being profiled (0.5*0.5=0.25)
        profilesSampleRate: 1.0`);
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

export const getAiRulesConfig = (params: Params): OnboardingStep =>
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
    // send console.log, console.warn, and console.error calls as logs to Sentry
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
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
    getAiRulesConfig(params),
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
    getAiRulesConfig(params),
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

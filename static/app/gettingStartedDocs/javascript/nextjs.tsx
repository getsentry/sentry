import {ExternalLink} from 'sentry/components/core/link';
import {CopyDsnField} from 'sentry/components/onboarding/gettingStartedDoc/copyDsnField';
import crashReportCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/crashReportCallout';
import {widgetCalloutBlock} from 'sentry/components/onboarding/gettingStartedDoc/feedback/widgetCallout';
import {tracePropagationBlock} from 'sentry/components/onboarding/gettingStartedDoc/replay/tracePropagationMessage';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getAIRulesForCodeEditorStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {
  getCrashReportJavaScriptInstallSteps,
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
import {t, tct} from 'sentry/locale';
import {
  getJavascriptFullStackOnboarding,
  getJavascriptLogsFullStackOnboarding,
} from 'sentry/utils/gettingStartedDocs/javascript';
import {getNodeAgentMonitoringOnboarding} from 'sentry/utils/gettingStartedDocs/node';

type Params = DocsParams;

const getInstallSnippet = ({isSelfHosted, organization, project}: Params) => {
  const urlParam = isSelfHosted ? '' : '--saas';
  return `npx @sentry/wizard@latest -i nextjs ${urlParam} --org ${organization.slug} --project ${project.slug}`;
};

const onboarding: OnboardingConfig = {
  install: (params: Params) => [
    {
      title: t('Automatic Configuration (Recommended)'),
      content: [
        {
          type: 'text',
          text: tct(
            'Configure your app automatically by running the [wizardLink:Sentry wizard] in the root of your project.',
            {
              wizardLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/#install" />
              ),
            }
          ),
        },
        {
          type: 'code',
          language: 'bash',
          code: getInstallSnippet(params),
        },
      ],
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
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/" />
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
    getAIRulesForCodeEditorStep({
      // ATTENTION: The rules defined here must match those in the documentation (see: https://github.com/getsentry/sentry-docs/blob/master/platform-includes/llm-rules-logs/javascript.nextjs.mdx).
      // If you make any changes, please update the docs accordingly.
      rules: `
These examples should be used as guidance when configuring Sentry functionality within a project.

# Exception Catching

Use \`Sentry.captureException(error)\` to capture an exception and log the error in Sentry.
Use this in try catch blocks or areas where exceptions are expected

# Tracing Examples

Spans should be created for meaningful actions within an applications like button clicks, API calls, and function calls
Use the \`Sentry.startSpan\` function to create a span
Child spans can exist within a parent span

## Custom Span instrumentation in component actions

The \`name\` and \`op\` properties should be meaninful for the activities in the call.
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

The \`name\` and \`op\` properties should be meaninful for the activities in the call.
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

Where logs are used, ensure Sentry is imported using \`import * as Sentry from "@sentry/nextjs"\`
Enable logging in Sentry using \`Sentry.init({ _experiments: { enableLogs: true } })\`
Reference the logger using \`const { logger } = Sentry\`
Sentry offers a consoleLoggingIntegration that can be used to log specific console error types automatically without instrumenting the individual logger calls

## Configuration

In NextJS the client side Sentry initialization is in \`instrumentation-client.ts\`, the server initialization is in \`sentry.server.config.ts\` and the edge initialization is in \`sentry.edge.config.ts\`
Initialization does not need to be repeated in other files, it only needs to happen the files mentioned above. You should use \`import * as Sentry from "@sentry/nextjs"\` to reference Sentry functionality

### Baseline

\`\`\`javascript
import * as Sentry from "@sentry/nextjs";

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
    }),
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: tct(
            'Start your development server and visit [code:/sentry-example-page] if you have set it up. Click the button to trigger a test error.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'text',
          text: t(
            'Or, trigger a sample error by calling a function that does not exist somewhere in your application.'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: `myUndefinedFunction();`,
            },
          ],
        },
        {
          type: 'text',
          text: t(
            'If you see an issue in your Sentry Issues, you have successfully set up Sentry with Next.js.'
          ),
        },
      ],
    },
  ],
};

const replayOnboarding: OnboardingConfig = {
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      content: [
        {type: 'text', text: t('Install the Next.js SDK using our installation wizard:')},
        {type: 'code', language: 'bash', code: getInstallSnippet(params)},
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getReplayConfigureDescription({
            link: 'https://docs.sentry.io/platforms/javascript/guides/nextjs/session-replay/',
          }),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              filename: 'sentry.client.config.js',
              language: 'javascript',
              code: getReplaySDKSetupSnippet({
                importStatement: `import * as Sentry from "@sentry/nextjs";`,
                dsn: params.dsn.public,
                mask: params.replayOptions?.mask,
                block: params.replayOptions?.block,
              }),
            },
          ],
        },
        tracePropagationBlock,
        {
          type: 'text',
          text: tct(
            'Note: The Replay integration only needs to be added to your [code:sentry.client.config.js] file. Adding it to any server-side configuration files (like [code:instrumentation.ts]) will break your build because the Replay integration depends on Browser APIs.',
            {
              code: <code />,
            }
          ),
        },
      ],
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
            'For the User Feedback integration to work, you must have the Sentry browser SDK package, or an equivalent framework SDK (e.g. [code:@sentry/nextjs]) installed, minimum version 7.85.0.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'text',
          text: t('Install the Next.js SDK using our installation wizard:'),
        },
        {
          type: 'code',
          language: 'bash',
          code: getInstallSnippet(params),
        },
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getFeedbackConfigureDescription({
            linkConfig:
              'https://docs.sentry.io/platforms/javascript/guides/nextjs/user-feedback/configuration/',
            linkButton:
              'https://docs.sentry.io/platforms/javascript/guides/nextjs/user-feedback/configuration/#bring-your-own-button',
          }),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              filename: 'sentry.client.config.js',
              language: 'javascript',
              code: getFeedbackSDKSetupSnippet({
                importStatement: `import * as Sentry from "@sentry/nextjs";`,
                dsn: params.dsn.public,
                feedbackOptions: params.feedbackOptions,
              }),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'Note: The User Feedback integration only needs to be added to your [code:sentry.client.config.js] file. Adding it to any server-side configuration files (like [code:instrumentation.ts]) will break your build because the Replay integration depends on Browser APIs.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'custom',
          content: crashReportCallout({
            link: 'https://docs.sentry.io/platforms/javascript/guides/nextjs/user-feedback/#crash-report-modal',
          }),
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportJavaScriptInstallSteps(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getCrashReportModalConfigDescription({
            link: 'https://docs.sentry.io/platforms/javascript/guides/nextjs/user-feedback/configuration/#crash-report-modal',
          }),
        },
        widgetCalloutBlock({
          link: 'https://docs.sentry.io/platforms/javascript/guides/nextjs/user-feedback/#user-feedback-widget',
        }),
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const performanceOnboarding: OnboardingConfig = {
  introduction: () =>
    t(
      "Adding Performance to your React project is simple. Make sure you've got these basics down."
    ),
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: t('Install the Next.js SDK using our installation wizard:'),
        },
        {
          type: 'code',
          language: 'bash',
          code: getInstallSnippet(params),
        },
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
            'To configure, set [code:tracesSampleRate] in your config files, [code:sentry.server.config.js], [code:sentry.client.config.js], and [code:sentry.edge.config.js]:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: `
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "${params.dsn.public}",

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
});
`,
        },
        {
          type: 'text',
          text: tct(
            'We recommend adjusting the value of [code:tracesSampleRate] in production. Learn more about tracing [linkTracingOptions:options], how to use the [linkTracesSampler:traces_sampler] function, or how to [linkSampleTransactions:sample transactions].',
            {
              code: <code />,
              linkTracingOptions: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#tracing-options" />
              ),
              linkTracesSampler: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/sampling/" />
              ),
              linkSampleTransactions: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/sampling/" />
              ),
            }
          ),
        },
      ],
    },
    {
      title: t('Add Distributed Tracing (Optional)'),
      content: [
        {
          type: 'text',
          text: tct(
            "If you're using the current version of our Next.js SDK, distributed tracing will work out of the box for the client, server, and edge runtimes.[break][break]For client-side you might have to define [code: tracePropagationTargets] to get around possible [link:Browser CORS] issues.",
            {
              break: <br />,
              code: <code />,
              link: (
                <ExternalLink href="https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS" />
              ),
            }
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: `
// sentry.client.config.js
Sentry.init({
  dsn: "${params.dsn.public}",
  integrations: [Sentry.browserTracingIntegration()],
  tracePropagationTargets: ["localhost", /^https:\\/\\/yourserver\\.io\\/api/]
});
`,
        },
        {
          type: 'text',
          text: tct(
            "If you're using version [code:7.57.x] or below, you'll need to have our [link:tracing feature enabled] in order for distributed tracing to work.",
            {
              code: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/tracing/" />
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
      content: [
        {
          type: 'text',
          text: tct(
            'Verify that performance monitoring is working correctly with our [link:automatic instrumentation] by simply using your NextJS application.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/tracing/instrumentation/automatic-instrumentation/" />
              ),
            }
          ),
        },
      ],
    },
  ],
  nextSteps: () => [],
};

const profilingOnboarding = getJavascriptFullStackOnboarding({
  basePackage: '@sentry/nextjs',
  browserProfilingLink:
    'https://docs.sentry.io/platforms/javascript/guides/nextjs/profiling/browser-profiling/',
  nodeProfilingLink:
    'https://docs.sentry.io/platforms/javascript/guides/nextjs/profiling/node-profiling/',
  getProfilingHeaderContent: () => [
    {
      type: 'text',
      text: tct(
        'In Next.js you can configure document response headers via the headers option in [code:next.config.js]:',
        {
          code: <code />,
        }
      ),
    },
    {
      type: 'code',
      tabs: [
        {
          label: 'ESM',
          language: 'javascript',
          filename: 'next.config.js',
          code: `
export default withSentryConfig({
  async headers() {
    return [{
      source: "/:path*",
      headers: [{
        key: "Document-Policy",
        value: "js-profiling",
      }],
    }];
  },
  // ... other Next.js config options
});`,
        },
        {
          label: 'CJS',
          language: 'javascript',
          filename: 'next.config.js',
          code: `
module.exports = withSentryConfig({
  async headers() {
    return [{
      source: "/:path*",
      headers: [{
        key: "Document-Policy",
        value: "js-profiling",
      }],
    }];
  },
  // ... other Next.js config options
});`,
        },
      ],
    },
  ],
});

const docs: Docs = {
  onboarding,
  feedbackOnboardingNpm: feedbackOnboarding,
  replayOnboarding,
  performanceOnboarding,
  crashReportOnboarding,
  featureFlagOnboarding,
  profilingOnboarding,
  logsOnboarding: getJavascriptLogsFullStackOnboarding({
    docsPlatform: 'nextjs',
    sdkPackage: '@sentry/nextjs',
  }),
  agentMonitoringOnboarding: getNodeAgentMonitoringOnboarding({
    basePackage: 'nextjs',
    configFileName: 'sentry.server.config.ts',
  }),
};

export default docs;

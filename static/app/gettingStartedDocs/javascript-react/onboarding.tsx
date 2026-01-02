import {tracePropagationBlock} from 'sentry/components/onboarding/gettingStartedDoc/replay/tracePropagationMessage';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getAIRulesForCodeEditorStep,
  getUploadSourceMapsStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {t, tct} from 'sentry/locale';

import {getSdkSetupSnippet, installSnippetBlock} from './utils';

const getVerifySnippet = (params: DocsParams) => {
  const logsCode = params.isLogsSelected
    ? `
        // Send a log before throwing the error
        Sentry.logger.info('User triggered test error', {
          action: 'test_error_button_click',
        });`
    : '';

  const metricsCode = params.isMetricsSelected
    ? `
        // Send a test metric before throwing the error
        Sentry.metrics.count('test_counter', 1);`
    : '';

  return `import * as Sentry from '@sentry/react';
// Add this button component to your app to test Sentry's error tracking
function ErrorButton() {
  return (
    <button
      onClick={() => {${logsCode}${metricsCode}
        throw new Error('This is your first error!');
      }}
    >
      Break the world
    </button>
  );
}`;
};

export const onboarding: OnboardingConfig = {
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
          text: tct(
            'Add the Sentry SDK as a dependency using [code:npm], [code:yarn], or [code:pnpm]:',
            {code: <code />}
          ),
        },
        installSnippetBlock,
      ],
    },
  ],
  configure: (params: DocsParams) => [
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
        {
          type: 'conditional',
          condition: params.isReplaySelected,
          content: [tracePropagationBlock],
        },
      ],
    },
    getUploadSourceMapsStep({
      guideLink: 'https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/',
      ...params,
    }),
    getAIRulesForCodeEditorStep({
      // ATTENTION: The rules defined here must match those in the documentation (see: https://github.com/getsentry/sentry-docs/blob/master/platform-includes/llm-rules-logs/javascript.react.mdx).
      // If you make any changes, please update the docs accordingly.
      rules: `
These examples should be used as guidance when configuring Sentry functionality within a project.

# Error / Exception Tracking

Use \`Sentry.captureException(error)\` to capture an exception and log the error in Sentry.
Use this in try catch blocks or areas where exceptions are expected

# Tracing Examples

Spans should be created for meaningful actions within an applications like button clicks, API calls, and function calls
Ensure you are creating custom spans with meaningful names and operations
Use the \`Sentry.startSpan\` function to create a span
Child spans can exist within a parent span

## Custom Span instrumentation in component actions

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

Where logs are used, ensure Sentry is imported using \`import * as Sentry from "@sentry/react"\`
Enable logging in Sentry using \`Sentry.init({ enableLogs: true })\`
Reference the logger using \`const { logger } = Sentry\`
Sentry offers a consoleLoggingIntegration that can be used to log specific console error types automatically without instrumenting the individual logger calls

## Configuration

### Baseline

\`\`\`javascript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "${params.dsn.public}",

  enableLogs: true,
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
  verify: (params: DocsParams) => [
    {
      type: StepType.VERIFY,
      content: [
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
              label: 'React',
              language: 'javascript',
              code: getVerifySnippet(params),
            },
          ],
        },
      ],
    },
  ],
  nextSteps: (params: DocsParams) => {
    const steps = [
      {
        id: 'react-features',
        name: t('React Features'),
        description: t(
          'Learn about our first class integration with the React framework.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/react/features/',
      },
    ];

    if (params.isPerformanceSelected) {
      steps.push({
        id: 'react-router',
        name: t('React Router'),
        description: t(
          'Configure routing, so Sentry can generate parameterized route names for better grouping of tracing data.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/react/configuration/integrations/react-router/',
      });
    }

    if (params.isLogsSelected) {
      steps.push({
        id: 'logs',
        name: t('Logging Integrations'),
        description: t(
          'Add logging integrations to automatically capture logs from your application.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/react/logs/#integrations',
      });
    }

    if (params.isMetricsSelected) {
      steps.push({
        id: 'metrics',
        name: t('Metrics'),
        description: t(
          'Learn how to track custom metrics to monitor your application performance and business KPIs.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/react/metrics/',
      });
    }

    return steps;
  },
};

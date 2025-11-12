import {ExternalLink} from 'sentry/components/core/link';
import {CopyDsnField} from 'sentry/components/onboarding/gettingStartedDoc/copyDsnField';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getAIRulesForCodeEditorStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {t, tct} from 'sentry/locale';

import {getInstallSnippet} from './utils';

export const onboarding: OnboardingConfig = {
  install: (params: DocsParams) => [
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
Enable logging in Sentry using \`Sentry.init({  enableLogs: true })\`
Reference the logger using \`const { logger } = Sentry\`
Sentry offers a consoleLoggingIntegration that can be used to log specific console error types automatically without instrumenting the individual logger calls

## Configuration

In NextJS the client side Sentry initialization is in \`instrumentation-client.(js|ts)\`, the server initialization is in \`sentry.server.config.ts\` and the edge initialization is in \`sentry.edge.config.ts\`
Initialization does not need to be repeated in other files, it only needs to happen the files mentioned above. You should use \`import * as Sentry from "@sentry/nextjs"\` to reference Sentry functionality

### Baseline

\`\`\`javascript
import * as Sentry from "@sentry/nextjs";

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
              code: 'myUndefinedFunction();',
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

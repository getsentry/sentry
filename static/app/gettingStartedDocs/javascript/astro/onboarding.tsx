import {Fragment} from 'react';

import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

import {installSnippetBlock} from './utils';

function getServerConfigSnippet(params: DocsParams) {
  const logsConfig = params.isLogsSelected
    ? `
  // Enable logs to be sent to Sentry
  enableLogs: true,`
    : '';

  const performanceConfig = params.isPerformanceSelected
    ? `
  // Define how likely traces are sampled. Adjust this value in production,
  // or use tracesSampler for greater control.
  tracesSampleRate: 1.0,`
    : '';

  return `
import * as Sentry from "@sentry/astro";

Sentry.init({
  dsn: "${params.dsn.public}",
  // Adds request headers and IP for users, for more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/astro/configuration/options/#sendDefaultPii
  sendDefaultPii: true,${logsConfig}${performanceConfig}
});
`;
}

function getClientConfigSnippet(params: DocsParams) {
  const logsConfig = params.isLogsSelected
    ? `
  // Enable logs to be sent to Sentry
  enableLogs: true,`
    : '';

  // Build integrations array based on selected features
  const integrations = [];
  if (params.isPerformanceSelected) {
    integrations.push('    Sentry.browserTracingIntegration(),');
  }
  if (params.isReplaySelected) {
    integrations.push('    Sentry.replayIntegration(),');
  }

  const integrationsConfig =
    integrations.length > 0
      ? `
  integrations: [
${integrations.join('\n')}
  ],`
      : '';

  const performanceConfig = params.isPerformanceSelected
    ? `
  // Define how likely traces are sampled. Adjust this value in production,
  // or use tracesSampler for greater control.
  tracesSampleRate: 1.0,`
    : '';

  const replaySampleRates = params.isReplaySelected
    ? `
  // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
  replaysSessionSampleRate: 0.1,
  // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
  replaysOnErrorSampleRate: 1.0,`
    : '';

  return `
import * as Sentry from "@sentry/astro";

Sentry.init({
  dsn: "${params.dsn.public}",
  // Adds request headers and IP for users, for more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/astro/configuration/options/#sendDefaultPii
  sendDefaultPii: true,${integrationsConfig}${logsConfig}${performanceConfig}${replaySampleRates}
});
`;
}

const getVerifySnippet = (params: DocsParams) => {
  const logsCode = params.isLogsSelected
    ? `
    // Send a log before throwing the error
    Sentry.logger.info(Sentry.logger.fmt\`User \${"sentry-test"} triggered test error button\`, {
      action: "test_error_button_click",
    });`
    : '';

  const metricsCode = params.isMetricsSelected
    ? `
    // Send a test metric before throwing the error
    Sentry.metrics.count('test_counter', 1);`
    : '';

  return `
<!-- your-page.astro -->
---
---
<button id="error-button">Throw test error</button>
<script>${
    params.isLogsSelected || params.isMetricsSelected
      ? `
  import * as Sentry from "@sentry/astro";`
      : ''
  }
  function handleClick () {${logsCode}${metricsCode}
    throw new Error('This is a test error');
  }
  document.querySelector("#error-button").addEventListener("click", handleClick);
</script>
`;
};

function getSdkSetupSnippet(params: DocsParams) {
  return `
import { defineConfig } from "astro/config";
import sentry from "@sentry/astro";

export default defineConfig({
  integrations: [
    sentry({
      project: "${params.project.slug}",
      org: "${params.organization.slug}",
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
});
`;
}

export const onboarding: OnboardingConfig = {
  introduction: () => (
    <Fragment>
      <p>
        {tct(
          "Sentry's integration with [astroLink:Astro] supports Astro 3.0.0 and above.",
          {
            astroLink: <ExternalLink href="https://astro.build/" />,
          }
        )}
      </p>
      <p>
        {tct(
          "In this quick guide you'll use the [astrocli:astro] CLI to set up Sentry with separate configuration files for client and server-side initialization:",
          {
            astrocli: <strong />,
          }
        )}
      </p>
    </Fragment>
  ),
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Install the [code:@sentry/astro] package with the [code:astro] CLI:',
            {
              code: <code />,
            }
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
          text: tct(
            'Configure the Sentry integration in your [astroConfig:astro.config.mjs] file:',
            {
              astroConfig: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'astro.config.mjs',
              language: 'javascript',
              code: getSdkSetupSnippet(params),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'Create a [clientConfig:sentry.client.config.js] file in the root of your project to configure the client-side SDK:',
            {
              clientConfig: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'sentry.client.config.js',
              language: 'javascript',
              code: getClientConfigSnippet(params),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'Create a [serverConfig:sentry.server.config.js] file in the root of your project to configure the server-side SDK:',
            {
              serverConfig: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'sentry.server.config.js',
              language: 'javascript',
              code: getServerConfigSnippet(params),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'Add your Sentry auth token to the [authTokenEnvVar:SENTRY_AUTH_TOKEN] environment variable:',
            {
              authTokenEnvVar: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'bash',
              language: 'bash',
              code: 'SENTRY_AUTH_TOKEN=___ORG_AUTH_TOKEN___',
            },
          ],
        },
      ],
    },
  ],
  verify: params => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Then throw a test error anywhere in your app, so you can test that everything is working:'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Astro',
              language: 'html',
              code: getVerifySnippet(params),
            },
          ],
        },
        {
          type: 'text',
          text: t(
            "If you're new to Sentry, use the email alert to access your account and complete a product tour."
          ),
        },
        {
          type: 'text',
          text: t(
            "If you're an existing user and have disabled alerts, you won't receive this email."
          ),
        },
      ],
    },
  ],
  nextSteps: params => {
    const steps = [
      {
        id: 'astro-manual-setup',
        name: t('Customize your SDK Setup'),
        description: t(
          'Learn how to further configure and customize your Sentry Astro SDK setup.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/astro/manual-setup/',
      },
    ];

    if (params.isLogsSelected) {
      steps.push({
        id: 'logs',
        name: t('Logging Integrations'),
        description: t(
          'Add logging integrations to automatically capture logs from your application.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/astro/logs/#integrations',
      });
    }

    if (params.isMetricsSelected) {
      steps.push({
        id: 'metrics',
        name: t('Metrics'),
        description: t(
          'Learn how to track custom metrics to monitor your application performance and business KPIs.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/astro/metrics/',
      });
    }

    return steps;
  },
};

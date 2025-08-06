import {Fragment} from 'react';

import {ExternalLink} from 'sentry/components/core/link';
import crashReportCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/crashReportCallout';
import widgetCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/widgetCallout';
import TracePropagationMessage from 'sentry/components/onboarding/gettingStartedDoc/replay/tracePropagationMessage';
import type {
  ContentBlock,
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportJavaScriptInstallStep,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
  getFeedbackConfigureDescription,
  getFeedbackSDKSetupSnippet,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {
  getReplaySDKSetupSnippet,
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {featureFlagOnboarding} from 'sentry/gettingStartedDocs/javascript/javascript';
import {t, tct} from 'sentry/locale';
import {getJavascriptFullStackOnboarding} from 'sentry/utils/gettingStartedDocs/javascript';

type Params = DocsParams;

const getSdkSetupSnippet = (params: Params) => {
  return `
import { defineConfig } from "astro/config";
import sentry from "@sentry/astro";

export default defineConfig({
  integrations: [
    sentry({
      sourceMapsUploadOptions: {
        project: "${params.projectSlug}",
        authToken: process.env.SENTRY_AUTH_TOKEN,
      },
    }),
  ],
});
`;
};

const getClientConfigSnippet = (params: Params) => {
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
};

const getServerConfigSnippet = (params: Params) => {
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
};

const getVerifySnippet = (params: Params) => {
  const logsCode = params.isLogsSelected
    ? `
    // Send a log before throwing the error
    Sentry.logger.info(Sentry.logger.fmt\`User \${"sentry-test"} triggered test error button\`, {
      action: "test_error_button_click",
    });`
    : '';

  return `
<!-- your-page.astro -->
---
---
<button id="error-button">Throw test error</button>
<script>${
    params.isLogsSelected
      ? `
  import * as Sentry from "@sentry/astro";`
      : ''
  }
  function handleClick () {${logsCode}
    throw new Error('This is a test error');
  }
  document.querySelector("#error-button").addEventListener("click", handleClick);
</script>
`;
};

const installSnippetBlock: ContentBlock = {
  type: 'code',
  tabs: [
    {
      label: 'bash',
      language: 'bash',
      code: 'npx astro add @sentry/astro',
    },
  ],
};

const onboarding: OnboardingConfig = {
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
  configure: (params: Params) => [
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
  verify: (params: Params) => [
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
  nextSteps: (params: Params) => {
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

    return steps;
  },
};

const replayOnboarding: OnboardingConfig = {
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
        {
          type: 'text',
          text: t('Session Replay is enabled by default when you install the Astro SDK!'),
        },
      ],
    },
  ],
  configure: (params: Params) => [
    {
      title: 'Configure Session Replay (Optional)',
      description: tct(
        'There are several privacy and sampling options available. Learn more about configuring Session Replay by reading the [link:configuration docs].',
        {
          link: (
            <ExternalLink
              href={
                'https://docs.sentry.io/platforms/javascript/guides/astro/session-replay/'
              }
            />
          ),
        }
      ),
      configurations: [
        {
          description: tct(
            'Configure the Sentry integration in your [code:astro.config.mjs] file:',
            {
              code: <code />,
            }
          ),
          code: [
            {
              label: 'astro.config.mjs',
              value: 'javascript',
              language: 'javascript',
              filename: 'astro.config.mjs',
              code: `
import { defineConfig } from "astro/config";
import sentry from "@sentry/astro";

export default defineConfig({
  integrations: [
    sentry({
      sourceMapsUploadOptions: {
        project: "${params.projectSlug}",
        authToken: process.env.SENTRY_AUTH_TOKEN,
      },
    }),
  ],
});
              `,
            },
          ],
          additionalInfo: tct(
            'Set sample rates and replay options in your [code:sentry.client.config.js] file:',
            {
              code: <code />,
            }
          ),
        },
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              filename: 'sentry.client.config.js',
              code: getReplaySDKSetupSnippet({
                importStatement: `// This file overrides \`astro.config.mjs\` for the browser-side.
// SDK options from \`astro.config.mjs\` will not apply.
import * as Sentry from "@sentry/astro";`,
                dsn: params.dsn.public,
                mask: params.replayOptions?.mask,
                block: params.replayOptions?.block,
              }),
            },
          ],
          additionalInfo: tct(
            `The [code:sentry.client.config.js] file allows you to configure client-side SDK options including replay settings. Learn more about manual SDK initialization [link:here].`,
            {
              code: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/astro/manual-setup/#manual-sdk-initialization" />
              ),
            }
          ),
        },
      ],
      additionalInfo: <TracePropagationMessage />,
      collapsible: true,
    },
  ],
  verify: getReplayVerifyStep(),
  nextSteps: () => [],
};

const feedbackOnboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'For the User Feedback integration to work, you must have the Sentry browser SDK package, or an equivalent framework SDK (e.g. [code:@sentry/astro]) installed, minimum version 7.85.0.',
            {
              code: <code />,
            }
          ),
        },
        installSnippetBlock,
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: getFeedbackConfigureDescription({
        linkConfig:
          'https://docs.sentry.io/platforms/javascript/guides/astro/user-feedback/configuration/',
        linkButton:
          'https://docs.sentry.io/platforms/javascript/guides/astro/user-feedback/configuration/#bring-your-own-button',
      }),
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getFeedbackSDKSetupSnippet({
                importStatement: `import * as Sentry from "@sentry/astro";`,
                dsn: params.dsn.public,
                feedbackOptions: params.feedbackOptions,
              }),
            },
          ],
        },
      ],
      additionalInfo: crashReportCallout({
        link: 'https://docs.sentry.io/platforms/javascript/guides/astro/user-feedback/#crash-report-modal',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportJavaScriptInstallStep(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getCrashReportModalConfigDescription({
        link: 'https://docs.sentry.io/platforms/javascript/guides/astro/user-feedback/configuration/#crash-report-modal',
      }),
      additionalInfo: widgetCallout({
        link: 'https://docs.sentry.io/platforms/javascript/guides/astro/user-feedback/#user-feedback-widget',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const profilingOnboarding = getJavascriptFullStackOnboarding({
  basePackage: '@sentry/astro',
  browserProfilingLink:
    'https://docs.sentry.io/platforms/javascript/guides/astro/profiling/browser-profiling/',
  nodeProfilingLink:
    'https://docs.sentry.io/platforms/javascript/guides/astro/profiling/node-profiling/',
});

const docs: Docs = {
  onboarding,
  feedbackOnboardingNpm: feedbackOnboarding,
  replayOnboarding,
  crashReportOnboarding,
  featureFlagOnboarding,
  profilingOnboarding,
};

export default docs;

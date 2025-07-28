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

const getSdkSetupSnippet = (params: Params) => `
import { defineConfig } from "astro/config";
import sentry from "@sentry/astro";

export default defineConfig({
  integrations: [
    sentry({
      dsn: "${params.dsn.public}",${
        params.isPerformanceSelected
          ? ''
          : `
      tracesSampleRate: 0,`
      }${
        params.isReplaySelected
          ? ''
          : `
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,`
      }${
        params.isLogsSelected
          ? `
      // Logs
      enableLogs: true,`
          : ''
      }
      // Setting this option to true will send default PII data to Sentry.
      // For example, automatic IP address collection on events
      sendDefaultPii: true,
      sourceMapsUploadOptions: {
        project: "${params.projectSlug}",
        authToken: process.env.SENTRY_AUTH_TOKEN,
      },
    }),
  ],
});
`;

const getVerifySnippet = () => `
<!-- your-page.astro -->
---
---
<button id="error-button">Throw test error</button>
<script>
  function handleClick () {
    throw new Error('This is a test error');
  }
  document.querySelector("#error-button").addEventListener("click", handleClick);
</script>
`;

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
        {tct("In this quick guide you'll use the [astrocli:astro] CLI to set up:", {
          astrocli: <strong />,
        })}
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
            'Open up your [astroConfig:astro.config.mjs] file and configure the DSN, and any other settings you need:',
            {
              astroConfig: <code />,
            }
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
        {
          type: 'text',
          text: tct(
            'You can further customize your SDK by [manualSetupLink:manually initializing the SDK].',
            {
              manualSetupLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/astro/manual-setup/" />
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
              code: getVerifySnippet(),
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
        link: 'https://docs.sentry.io/platforms/javascript/guides/astro/logs/#integrations/',
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
            'You can set sample rates directly in your [code:astro.config.js] file:',
            {
              code: <code />,
            }
          ),
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              filename: 'astro.config.js',
              code: `
import { defineConfig } from "astro/config";
import sentry from "@sentry/astro";

export default defineConfig({
  integrations: [
    sentry({
      dsn: "${params.dsn.public}",
      replaysSessionSampleRate: 0.2, // defaults to 0.1
      replaysOnErrorSampleRate: 1.0, // defaults to 1.0
    }),
  ],
});
              `,
            },
          ],
          additionalInfo: tct(
            'Further Replay options, like privacy settings, can be set in a [code:sentry.client.config.js] file:',
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
            `Note that creating your own [code:sentry.client.config.js] file will override the default settings in your [code:astro.config.js] file. Learn more about this [link:here].`,
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

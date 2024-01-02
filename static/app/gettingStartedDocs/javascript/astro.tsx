import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getReplayConfigureDescription,
  getReplaySDKSetupSnippet,
} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {getJSMetricsOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getSdkSetupSnippet = (params: Params) => `
import { defineConfig } from "astro/config";
import sentry from "@sentry/astro";

export default defineConfig({
  integrations: [
    sentry({
      dsn: "${params.dsn}",${
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
      }
      sourceMapsUploadOptions: {
        project: "${params.projectSlug}",
        authToken: process.env.SENTRY_AUTH_TOKEN,
      },
    }),
  ],
});
`;

const getVerifyAstroSnippet = () => `
<!-- your-page.astro -->
<button onclick="throw new Error('This is a test error')">
  Throw test error
</button>
`;

const getInstallConfig = () => [
  {
    type: StepType.INSTALL,
    description: tct(
      'Install the [sentryAstroPkg:@sentry/astro] package with the [astroCli:astro] CLI:',
      {
        sentryAstroPkg: <code />,
        astroCli: <code />,
      }
    ),
    configurations: [
      {
        language: 'bash',
        code: [
          {
            label: 'bash',
            value: 'bash',
            language: 'bash',
            code: `npx astro add @sentry/astro`,
          },
        ],
      },
    ],
  },
];

const onboarding: OnboardingConfig = {
  introduction: () =>
    tct("Sentry's integration with [astroLink:Astro] supports Astro 3.0.0 and above.", {
      astroLink: <ExternalLink href="https://astro.build/" />,
    }),
  install: () => getInstallConfig(),
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'Open up your [astroConfig:astro.config.mjs] file and configure the DSN, and any other settings you need:',
        {
          astroConfig: <code />,
        }
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
        {
          description: tct(
            'Add your Sentry auth token to the [authTokenEnvVar:SENTRY_AUTH_TOKEN] environment variable:',
            {
              authTokenEnvVar: <code />,
            }
          ),
          language: 'bash',
          code: [
            {
              value: 'bash',
              language: 'bash',
              label: 'bash',
              code: `SENTRY_AUTH_TOKEN=___ORG_AUTH_TOKEN___`,
            },
          ],
        },
        {
          description: tct(
            'You can further customize your SDK by [manualSetupLink:manually inializing the SDK].',
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
      description: t(
        'Then throw a test error anywhere in your app, so you can test that everything is working:'
      ),
      configurations: [
        {
          code: [
            {
              label: 'Astro',
              value: 'html',
              language: 'html',
              code: getVerifyAstroSnippet(),
            },
          ],
        },
      ],
      additionalInfo: (
        <Fragment>
          <p>
            {t(
              "If you're new to Sentry, use the email alert to access your account and complete a product tour."
            )}
          </p>
          <p>
            {t(
              "If you're an existing user and have disabled alerts, you won't receive this email."
            )}
          </p>
        </Fragment>
      ),
    },
  ],
  nextSteps: () => [
    {
      id: 'astro-manual-setup',
      name: t('Customize your SDK Setup'),
      description: t(
        'Learn how to further configure and customize your Sentry Astro SDK setup.'
      ),
      link: 'https://docs.sentry.io/platforms/javascript/guides/astro/manual-setup/',
    },
    {
      id: 'performance-monitoring',
      name: t('Performance Monitoring'),
      description: t(
        'Track down transactions to connect the dots between 10-second page loads and poor-performing API calls or slow database queries.'
      ),
      link: 'https://docs.sentry.io/platforms/javascript/guides/astro/performance/',
    },
    {
      id: 'session-replay',
      name: t('Session Replay'),
      description: t(
        'Get to the root cause of an error or latency issue faster by seeing all the technical details related to that issue in one visual replay on your web application.'
      ),
      link: 'https://docs.sentry.io/platforms/javascript/guides/astro/session-replay/',
    },
  ],
};

const replayOnboarding: OnboardingConfig = {
  install: () => getInstallConfig(),
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: getReplayConfigureDescription({
        link: 'https://docs.sentry.io/platforms/javascript/guides/astro/session-replay/',
      }),
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getReplaySDKSetupSnippet({
                importStatement: `import * as Sentry from "@sentry/astro";`,
                dsn: params.dsn,
                mask: params.replayOptions?.mask,
                block: params.replayOptions?.block,
              }),
            },
          ],
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  replayOnboardingNpm: replayOnboarding,
  customMetricsOnboarding: getJSMetricsOnboarding({getInstallConfig}),
};

export default docs;

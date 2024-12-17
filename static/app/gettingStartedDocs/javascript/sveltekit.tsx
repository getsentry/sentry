import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list/';
import ListItem from 'sentry/components/list/listItem';
import crashReportCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/crashReportCallout';
import widgetCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/widgetCallout';
import TracePropagationMessage from 'sentry/components/onboarding/gettingStartedDoc/replay/tracePropagationMessage';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportJavaScriptInstallStep,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
  getFeedbackConfigureDescription,
  getFeedbackSDKSetupSnippet,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {getJSMetricsOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import {
  getReplayConfigureDescription,
  getReplaySDKSetupSnippet,
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {featureFlagOnboarding} from 'sentry/gettingStartedDocs/javascript/javascript';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getConfigStep = ({isSelfHosted, organization, projectSlug}: Params) => {
  const urlParam = isSelfHosted ? '' : '--saas';

  return [
    {
      type: StepType.INSTALL,
      description: tct(
        'Configure your app automatically by running the [wizardLink:Sentry wizard] in the root of your project.',
        {
          wizardLink: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/sveltekit/#install" />
          ),
        }
      ),
      configurations: [
        {
          language: 'bash',
          code: `npx @sentry/wizard@latest -i sveltekit ${urlParam}  --org ${organization.slug} --project ${projectSlug}`,
        },
      ],
    },
  ];
};

const getInstallConfig = (params: Params) => [
  {
    type: StepType.INSTALL,
    configurations: getConfigStep(params),
  },
];

const onboarding: OnboardingConfig = {
  install: (params: Params) => [
    {
      title: t('Automatic Configuration (Recommended)'),
      configurations: getConfigStep(params),
    },
  ],
  configure: () => [
    {
      title: t('Manual Configuration'),
      collapsible: true,
      description: tct(
        'Alternatively, you can also [manualSetupLink:set up the SDK manually], by following these steps:',
        {
          manualSetupLink: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/sveltekit/manual-setup/" />
          ),
        }
      ),
      configurations: [
        {
          description: (
            <List symbol="bullet">
              <ListItem>
                {tct(
                  'Create or update [code:src/hooks.client.js] and [code:src/hooks.server.js] with the default [code:Sentry.init] call and SvelteKit hooks handlers.',
                  {
                    code: <code />,
                  }
                )}
              </ListItem>
              <ListItem>
                {tct(
                  'Update [code:vite.config.js] to add source maps upload and auto-instrumentation via Vite plugins.',
                  {
                    code: <code />,
                  }
                )}
              </ListItem>
              <ListItem>
                {tct(
                  'Create [code:.sentryclirc] and [code:sentry.properties] files with configuration for sentry-cli (which is used when automatically uploading source maps).',
                  {
                    code: <code />,
                  }
                )}
              </ListItem>
            </List>
          ),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: (
        <Fragment>
          <p>
            {tct(
              'Start your development server and visit [code:/sentry-example-page] if you have set it up. Click the button to trigger a test error.',
              {
                code: <code />,
              }
            )}
          </p>
          <p>
            {t(
              'Or, trigger a sample error by calling a function that does not exist somewhere in your application.'
            )}
          </p>
        </Fragment>
      ),
      configurations: [
        {
          code: [
            {
              label: 'Javascript',
              value: 'javascript',
              language: 'javascript',
              code: `myUndefinedFunction();`,
            },
          ],
        },
      ],
      additionalInfo: t(
        'If you see an issue in your Sentry dashboard, you have successfully set up Sentry.'
      ),
    },
  ],
};

const replayOnboarding: OnboardingConfig = {
  install: (params: Params) => getInstallConfig(params),
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: getReplayConfigureDescription({
        link: 'https://docs.sentry.io/platforms/javascript/guides/sveltekit/session-replay/',
      }),
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getReplaySDKSetupSnippet({
                importStatement: `import * as Sentry from "@sentry/sveltekit";`,
                dsn: params.dsn.public,
                mask: params.replayOptions?.mask,
                block: params.replayOptions?.block,
              }),
            },
          ],
          additionalInfo: <TracePropagationMessage />,
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
      description: tct(
        'For the User Feedback integration to work, you must have the Sentry browser SDK package, or an equivalent framework SDK (e.g. [code:@sentry/sveltekit]) installed, minimum version 7.85.0.',
        {
          code: <code />,
        }
      ),
      configurations: getInstallConfig(params),
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: getFeedbackConfigureDescription({
        linkConfig:
          'https://docs.sentry.io/platforms/javascript/guides/sveltekit/user-feedback/configuration/',
        linkButton:
          'https://docs.sentry.io/platforms/javascript/guides/sveltekit/user-feedback/configuration/#bring-your-own-button',
      }),
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getFeedbackSDKSetupSnippet({
                importStatement: `import * as Sentry from "@sentry/sveltekit";`,
                dsn: params.dsn.public,
                feedbackOptions: params.feedbackOptions,
              }),
            },
          ],
        },
      ],
      additionalInfo: crashReportCallout({
        link: 'https://docs.sentry.io/platforms/javascript/guides/sveltekit/user-feedback/#crash-report-modal',
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
        link: 'https://docs.sentry.io/platforms/javascript/guides/sveltekit/user-feedback/configuration/#crash-report-modal',
      }),
      additionalInfo: widgetCallout({
        link: 'https://docs.sentry.io/platforms/javascript/guides/sveltekit/user-feedback/#user-feedback-widget',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  feedbackOnboardingNpm: feedbackOnboarding,
  replayOnboarding,
  customMetricsOnboarding: getJSMetricsOnboarding({getInstallConfig}),
  crashReportOnboarding,
  featureFlagOnboarding,
};

export default docs;

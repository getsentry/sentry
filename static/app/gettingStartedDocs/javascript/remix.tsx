import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
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
      description: tct(
        'Configure your app automatically by running the [wizardLink:Sentry wizard] in the root of your project.',
        {
          wizardLink: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/remix/#install" />
          ),
        }
      ),
      language: 'bash',
      code: `npx @sentry/wizard@latest -i remix ${urlParam}  --org ${organization.slug} --project ${projectSlug}`,
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
  introduction: () => (
    <p>
      {tct(
        "Sentry's integration with [remixLink:Remix] supports Remix 1.0.0 and above.",
        {
          remixLink: <ExternalLink href="https://remix.run/" />,
        }
      )}
    </p>
  ),
  install: (params: Params) => [
    {
      title: t('Automatic Configuration (Recommended)'),
      configurations: getConfigStep(params),
    },
  ],
  configure: () => [
    {
      collapsible: true,
      title: t('Manual Configuration'),
      description: tct(
        'Alternatively, you can also [manualSetupLink:set up the SDK manually], by following these steps:',
        {
          manualSetupLink: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/remix/manual-setup/" />
          ),
        }
      ),
      configurations: [
        {
          description: (
            <List symbol="bullet">
              <ListItem>
                {tct(
                  "Create two files in the root directory of your project, [code:entry.client.tsx] and [code:entry.server.tsx] (if they don't already exist).",
                  {
                    code: <code />,
                  }
                )}
              </ListItem>
              <ListItem>
                {tct(
                  'Add the default [sentryInitCode:Sentry.init] call to both, client and server entry files.',
                  {
                    sentryInitCode: <code />,
                  }
                )}
              </ListItem>
              <ListItem>
                {tct(
                  'Create a [code:.sentryclirc] with an auth token to upload source maps (this file is automatically added to your [code:.gitignore]).',
                  {
                    code: <code />,
                  }
                )}
              </ListItem>
              <ListItem>
                {tct(
                  'Adjust your [code:build] script in your [code:package.json] to automatically upload source maps to Sentry when you build your application.',
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
  nextSteps: () => [],
};

const replayOnboarding: OnboardingConfig = {
  install: (params: Params) => getInstallConfig(params),
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: getReplayConfigureDescription({
        link: 'https://docs.sentry.io/platforms/javascript/guides/remix/session-replay/',
      }),
      configurations: [
        {
          code: [
            {
              label: 'entry.client.tsx',
              value: 'javascript',
              language: 'javascript',
              code: getReplaySDKSetupSnippet({
                importStatement: `import * as Sentry from "@sentry/remix";`,
                dsn: params.dsn.public,
                mask: params.replayOptions?.mask,
                block: params.replayOptions?.block,
              }),
            },
          ],
        },
      ],
      additionalInfo: (
        <Fragment>
          <TracePropagationMessage />
          {tct(
            'Note: The Replay integration only needs to be added to your [code:entry.client.tsx] file. It will not run if it is added into [code:sentry.server.config.js].',
            {code: <code />}
          )}
        </Fragment>
      ),
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
        'For the User Feedback integration to work, you must have the Sentry browser SDK package, or an equivalent framework SDK (e.g. [code:@sentry/remix]) installed, minimum version 7.85.0.',
        {
          code: <code />,
        }
      ),
      configurations: getConfigStep(params),
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: getFeedbackConfigureDescription({
        linkConfig:
          'https://docs.sentry.io/platforms/javascript/guides/remix/user-feedback/configuration/',
        linkButton:
          'https://docs.sentry.io/platforms/javascript/guides/remix/user-feedback/configuration/#bring-your-own-button',
      }),
      configurations: [
        {
          code: [
            {
              label: 'entry.client.tsx',
              value: 'javascript',
              language: 'javascript',
              code: getFeedbackSDKSetupSnippet({
                importStatement: `import * as Sentry from "@sentry/remix";`,
                dsn: params.dsn.public,
                feedbackOptions: params.feedbackOptions,
              }),
            },
          ],
        },
      ],
      additionalInfo: (
        <Fragment>
          <p>
            {tct(
              'Note: The Feedback integration only needs to be added to your [code:entry.client.tsx] file.',
              {code: <code />}
            )}
          </p>

          {crashReportCallout({
            link: 'https://docs.sentry.io/platforms/javascript/guides/remix/user-feedback/#user-feedback-api',
          })}
        </Fragment>
      ),
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
        link: 'https://docs.sentry.io/platforms/javascript/guides/remix/user-feedback/configuration/#crash-report-modal',
      }),
      additionalInfo: widgetCallout({
        link: 'https://docs.sentry.io/platforms/javascript/guides/remix/user-feedback/#user-feedback-widget',
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
  featureFlagOnboarding: featureFlagOnboarding,
};

export default docs;

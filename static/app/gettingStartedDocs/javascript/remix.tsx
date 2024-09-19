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
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getConfigStep = ({isSelfHosted, urlPrefix, organization, projectSlug}: Params) => {
  const urlParam = !isSelfHosted && urlPrefix ? `--url ${urlPrefix}` : '';
  return [
    {
      description: tct(
        'Configure your app automatically with the [wizardLink:Sentry wizard].',
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
  introduction: () =>
    tct("Sentry's integration with [remixLink:Remix] supports Remix 1.0.0 and above.", {
      remixLink: <ExternalLink href="https://remix.run/" />,
    }),
  install: (params: Params) => getInstallConfig(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: t(
        'The Sentry wizard will automatically add code to your project to inialize and configure the Sentry SDK:'
      ),
      configurations: [
        {
          description: (
            <List symbol="bullet">
              <ListItem>
                {tct(
                  "Create two files in the root directory of your project, [clientEntry:entry.client.tsx] and [serverEntry:entry.server.tsx] (if they don't already exist).",
                  {
                    clientEntry: <code />,
                    serverEntry: <code />,
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
                  'Create a [cliRc:.sentryclirc] with an auth token to upload source maps (this file is automatically added to your [gitignore:.gitignore]).',
                  {
                    cliRc: <code />,
                    gitignore: <code />,
                  }
                )}
              </ListItem>
              <ListItem>
                {tct(
                  'Adjust your [buildscript:build] script in your [pkgJson:package.json] to automatically upload source maps to Sentry when you build your application.',
                  {
                    buildscript: <code />,
                    pkgJson: <code />,
                  }
                )}
              </ListItem>
            </List>
          ),
        },
        {
          description: tct(
            'You can also further [manualConfigure:configure your SDK] or [manualSetupLink:set it up manually], without the wizard.',
            {
              manualConfigure: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/remix/manual-setup/#configuration" />
              ),
              manualSetupLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/remix/manual-setup/" />
              ),
            }
          ),
        },
      ],
    },
  ],
  verify: () => [],
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
            'Note: The Replay integration only needs to be added to your [entryClient:entry.client.tsx] file. It will not run if it is added into [sentryServer:sentry.server.config.js].',
            {entryClient: <code />, sentryServer: <code />}
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
};

export default docs;

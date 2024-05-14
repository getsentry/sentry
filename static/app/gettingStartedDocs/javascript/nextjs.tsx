import {Fragment} from 'react';
import styled from '@emotion/styled';

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
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';

type Params = DocsParams;

const getInstallConfig = () => [
  {
    description: tct(
      'Configure your app automatically with the [wizardLink:Sentry wizard].',
      {
        wizardLink: (
          <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/#install" />
        ),
      }
    ),
    language: 'bash',
    code: `npx @sentry/wizard@latest -i nextjs`,
  },
];

const getManualInstallConfig = () => [
  {
    language: 'bash',
    code: [
      {
        label: 'npm',
        value: 'npm',
        language: 'bash',
        code: 'npm install --save @sentry/nextjs',
      },
      {
        label: 'yarn',
        value: 'yarn',
        language: 'bash',
        code: 'yarn add @sentry/nextjs',
      },
    ],
  },
];

const onboarding: OnboardingConfig = {
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      configurations: getInstallConfig(),
      additionalInfo: (
        <Fragment>
          {t(
            'The Sentry wizard will automatically patch your application to configure the Sentry SDK:'
          )}
          <List symbol="bullet">
            <ListItem>
              {tct(
                'Create [serverCode:sentry.server.config.js], [clientCode:sentry.client.config.js] and [edgeCode:sentry.edge.config.js] with the default [sentryInitCode:Sentry.init].',
                {
                  clientCode: <code />,
                  serverCode: <code />,
                  edgeCode: <code />,
                  sentryInitCode: <code />,
                }
              )}
            </ListItem>
            <ListItem>
              {tct(
                'Create or update the Next.js instrumentation file [instrumentationCode:instrumentation.ts] to initialize the SDK with the configuration files added in the previous step.',
                {
                  instrumentationCode: <code />,
                }
              )}
            </ListItem>
            <ListItem>
              {tct(
                'Create or update your Next.js config [nextConfig:next.config.js] with the default Sentry configuration.',
                {
                  nextConfig: <code />,
                }
              )}
            </ListItem>
            <ListItem>
              {tct(
                'Create a [bundlerPluginsEnv:.env.sentry-build-plugin] with an auth token (which is used to upload source maps when building the application).',
                {
                  bundlerPluginsEnv: <code />,
                }
              )}
            </ListItem>
            <ListItem>
              {t('Add an example page to your app to verify your Sentry setup.')}
            </ListItem>
          </List>
          <br />
          <ManualSetupTitle>{t('Manual Setup')}</ManualSetupTitle>
          <p>
            {tct(
              'Alternatively, you can also [manualSetupLink:set up the SDK manually].',
              {
                manualSetupLink: (
                  <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/" />
                ),
              }
            )}
          </p>
          <br />
          <DSNText>
            <p>
              {tct(
                "If you already have the configuration for Sentry in your application, and just need this project's ([projectSlug]) DSN, you can find it below:",
                {
                  projectSlug: <code>{params.projectSlug}</code>,
                }
              )}
            </p>
          </DSNText>
          {params.organization && (
            <TextCopyInput
              onCopy={() =>
                trackAnalytics('onboarding.nextjs-dsn-copied', {
                  organization: params.organization,
                })
              }
            >
              {params.dsn}
            </TextCopyInput>
          )}
        </Fragment>
      ),
    },
  ],
  configure: () => [],
  verify: () => [],
};

const replayOnboarding: OnboardingConfig = {
  install: () => [{type: StepType.INSTALL, configurations: getInstallConfig()}],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: getReplayConfigureDescription({
        link: 'https://docs.sentry.io/platforms/javascript/guides/nextjs/session-replay/',
      }),
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getReplaySDKSetupSnippet({
                importStatement: `import * as Sentry from "@sentry/nextjs";`,
                dsn: params.dsn,
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
            'Alert: The Replay integration must be added to your [sentryClient:sentry.client.config.js] file. Adding it to any server-side configuration files (like [instrumentation:instrumentation.ts]) will break your build because the Replay integration depends on Browser APIs.',
            {
              sentryClient: <code />,
              instrumentation: <code />,
            }
          )}
        </Fragment>
      ),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const feedbackOnboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'For the User Feedback integration to work, you must have the Sentry browser SDK package, or an equivalent framework SDK (e.g. [code:@sentry/nextjs]) installed, minimum version 7.85.0.',
        {
          code: <code />,
        }
      ),
      configurations: getInstallConfig(),
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: getFeedbackConfigureDescription({
        linkConfig:
          'https://docs.sentry.io/platforms/javascript/guides/nextjs/user-feedback/configuration/',
        linkButton:
          'https://docs.sentry.io/platforms/javascript/guides/nextjs/user-feedback/configuration/#bring-your-own-button',
      }),
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getFeedbackSDKSetupSnippet({
                importStatement: `import * as Sentry from "@sentry/nextjs";`,
                dsn: params.dsn,
                feedbackOptions: params.feedbackOptions,
              }),
            },
          ],
        },
      ],
      additionalInfo: (
        <Fragment>
          {tct(
            'Alert: The User Feedback integration must be added to your [sentryClient:sentry.client.config.js] file. Adding it to any server-side configuration files (like [instrumentation:instrumentation.ts]) will break your build because the Replay integration depends on Browser APIs.',
            {
              sentryClient: <code />,
              instrumentation: <code />,
            }
          )}
          {crashReportCallout({
            link: 'https://docs.sentry.io/platforms/javascript/guides/nextjs/user-feedback/#crash-report-modal',
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
        link: 'https://docs.sentry.io/platforms/javascript/guides/nextjs/user-feedback/configuration/#crash-report-modal',
      }),
      additionalInfo: widgetCallout({
        link: 'https://docs.sentry.io/platforms/javascript/guides/nextjs/user-feedback/#user-feedback-widget',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  feedbackOnboardingNpm: feedbackOnboarding,
  replayOnboardingNpm: replayOnboarding,
  customMetricsOnboarding: getJSMetricsOnboarding({
    getInstallConfig: getManualInstallConfig,
  }),
  crashReportOnboarding,
};

export default docs;

const DSNText = styled('div')`
  margin-bottom: ${space(0.5)};
`;

const ManualSetupTitle = styled('p')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: bold;
`;

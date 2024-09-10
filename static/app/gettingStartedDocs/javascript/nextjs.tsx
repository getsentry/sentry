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
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';

type Params = DocsParams;

const getInstallConfig = ({isSelfHosted, urlPrefix}: Params) => {
  const urlParam = !isSelfHosted && urlPrefix ? `--url ${urlPrefix}` : '';

  return [
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
      code: `npx @sentry/wizard@latest -i nextjs ${urlParam}`,
    },
  ];
};

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
      configurations: getInstallConfig(params),
      additionalInfo: (
        <Fragment>
          {t(
            'The Sentry wizard will automatically patch your application to configure the Sentry SDK:'
          )}
          <List symbol="bullet">
            <ListItem>
              {tct(
                'Create [code:sentry.server.config.js], [code:sentry.client.config.js] and [code:sentry.edge.config.js] with the default [code:Sentry.init].',
                {
                  code: <code />,
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
              {params.dsn.public}
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
  install: (params: Params) => [
    {type: StepType.INSTALL, configurations: getInstallConfig(params)},
  ],
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
              label: 'sentry.client.config.js',
              value: 'javascript',
              language: 'javascript',
              code: getReplaySDKSetupSnippet({
                importStatement: `import * as Sentry from "@sentry/nextjs";`,
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
            'Note: The Replay integration only needs to be added to your [code:sentry.client.config.js] file. Adding it to any server-side configuration files (like [code:instrumentation.ts]) will break your build because the Replay integration depends on Browser APIs.',
            {
              code: <code />,
            }
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
        'For the User Feedback integration to work, you must have the Sentry browser SDK package, or an equivalent framework SDK (e.g. [code:@sentry/nextjs]) installed, minimum version 7.85.0.',
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
          'https://docs.sentry.io/platforms/javascript/guides/nextjs/user-feedback/configuration/',
        linkButton:
          'https://docs.sentry.io/platforms/javascript/guides/nextjs/user-feedback/configuration/#bring-your-own-button',
      }),
      configurations: [
        {
          code: [
            {
              label: 'sentry.client.config.js',
              value: 'javascript',
              language: 'javascript',
              code: getFeedbackSDKSetupSnippet({
                importStatement: `import * as Sentry from "@sentry/nextjs";`,
                dsn: params.dsn.public,
                feedbackOptions: params.feedbackOptions,
              }),
            },
          ],
        },
      ],
      additionalInfo: (
        <AdditionalInfoWrapper>
          <div>
            {tct(
              'Note: The User Feedback integration only needs to be added to your [code:sentry.client.config.js] file. Adding it to any server-side configuration files (like [code:instrumentation.ts]) will break your build because the Replay integration depends on Browser APIs.',
              {
                code: <code />,
              }
            )}
          </div>
          <div>
            {crashReportCallout({
              link: 'https://docs.sentry.io/platforms/javascript/guides/nextjs/user-feedback/#crash-report-modal',
            })}
          </div>
        </AdditionalInfoWrapper>
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
  replayOnboarding,
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
  font-weight: ${p => p.theme.fontWeightBold};
`;

const AdditionalInfoWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

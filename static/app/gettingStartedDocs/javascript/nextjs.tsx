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
import {featureFlagOnboarding} from 'sentry/gettingStartedDocs/javascript/javascript';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';

type Params = DocsParams;

const getInstallSnippet = ({isSelfHosted, organization, projectSlug}: Params) => {
  const urlParam = isSelfHosted ? '' : '--saas';
  return `npx @sentry/wizard@latest -i nextjs ${urlParam} --org ${organization.slug} --project ${projectSlug}`;
};

const getInstallConfig = (params: Params) => {
  return [
    {
      description: tct(
        'Configure your app automatically by running the [wizardLink:Sentry wizard] in the root of your project.',
        {
          wizardLink: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/#install" />
          ),
        }
      ),
      language: 'bash',
      code: getInstallSnippet(params),
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
      title: t('Automatic Configuration (Recommended)'),
      configurations: getInstallConfig(params),
    },
  ],
  configure: () => [
    {
      title: t('Manual Configuration'),
      collapsible: true,
      configurations: [
        {
          description: (
            <Fragment>
              <p>
                {tct(
                  'Alternatively, you can also [manualSetupLink:set up the SDK manually], by following these steps:',
                  {
                    manualSetupLink: (
                      <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/" />
                    ),
                  }
                )}
              </p>
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
            </Fragment>
          ),
        },
      ],
    },
  ],
  verify: (params: Params) => [
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
      additionalInfo: (
        <Fragment>
          <p>
            {t(
              'If you see an issue in your Sentry dashboard, you have successfully set up Sentry with Next.js.'
            )}
          </p>
          <Divider />
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

const performanceOnboarding: OnboardingConfig = {
  introduction: () =>
    t(
      "Adding Performance to your React project is simple. Make sure you've got these basics down."
    ),
  install: params => [
    {
      type: StepType.INSTALL,
      description: t('Install the Next.js SDK using our installation wizard:'),
      configurations: [
        {
          language: 'bash',
          code: getInstallSnippet(params),
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'To configure, set [code:tracesSampleRate] in your config files, [code:sentry.server.config.js], [code:sentry.client.config.js], and [code:sentry.edge.config.js]:',
        {code: <code />}
      ),
      configurations: [
        {
          language: 'javascript',
          code: `
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "${params.dsn.public}",

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
});
`,
          additionalInfo: tct(
            'We recommend adjusting the value of [code:tracesSampleRate] in production. Learn more about tracing [linkTracingOptions:options], how to use the [linkTracesSampler:traces_sampler] function, or how to [linkSampleTransactions:sample transactions].',
            {
              code: <code />,
              linkTracingOptions: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#tracing-options" />
              ),
              linkTracesSampler: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/sampling/" />
              ),
              linkSampleTransactions: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/sampling/" />
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
      description: tct(
        'Verify that performance monitoring is working correctly with our [link:automatic instrumentation] by simply using your NextJS application.',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/tracing/instrumentation/automatic-instrumentation/" />
          ),
        }
      ),
      additionalInfo: tct(
        'You have the option to manually construct a transaction using [link:custom instrumentation].',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/tracing/instrumentation/custom-instrumentation/" />
          ),
        }
      ),
    },
  ],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  feedbackOnboardingNpm: feedbackOnboarding,
  replayOnboarding,
  customMetricsOnboarding: getJSMetricsOnboarding({
    getInstallConfig: getManualInstallConfig,
  }),
  performanceOnboarding,
  crashReportOnboarding,
  featureFlagOnboarding: featureFlagOnboarding,
};

export default docs;

const DSNText = styled('div')`
  margin-bottom: ${space(0.5)};
`;

const AdditionalInfoWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const Divider = styled('hr')`
  height: 1px;
  width: 100%;
  background: ${p => p.theme.border};
  border: none;
  margin-top: ${space(1)};
  margin-bottom: ${space(2)};
`;

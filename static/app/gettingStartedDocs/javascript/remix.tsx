import {ExternalLink} from 'sentry/components/core/link';
import {CopyDsnField} from 'sentry/components/onboarding/gettingStartedDoc/copyDsnField';
import crashReportCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/crashReportCallout';
import {widgetCalloutBlock} from 'sentry/components/onboarding/gettingStartedDoc/feedback/widgetCallout';
import {tracePropagationBlock} from 'sentry/components/onboarding/gettingStartedDoc/replay/tracePropagationMessage';
import type {
  ContentBlock,
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportJavaScriptInstallSteps,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
  getFeedbackConfigureDescription,
  getFeedbackSDKSetupSnippet,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {
  getReplayConfigureDescription,
  getReplaySDKSetupSnippet,
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {featureFlagOnboarding} from 'sentry/gettingStartedDocs/javascript/javascript';
import {t, tct} from 'sentry/locale';
import {
  getJavascriptFullStackOnboarding,
  getJavascriptLogsFullStackOnboarding,
} from 'sentry/utils/gettingStartedDocs/javascript';
import {getNodeAgentMonitoringOnboarding} from 'sentry/utils/gettingStartedDocs/node';

type Params = DocsParams;

const getInstallContent = ({
  isSelfHosted,
  organization,
  project,
}: Params): ContentBlock[] => [
  {
    type: 'text',
    text: tct(
      'Configure your app automatically by running the [wizardLink:Sentry wizard] in the root of your project.',
      {
        wizardLink: (
          <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/remix/#install" />
        ),
      }
    ),
  },
  {
    type: 'code',
    language: 'bash',
    code: `npx @sentry/wizard@latest -i remix ${isSelfHosted ? '' : '--saas'}  --org ${organization.slug} --project ${project.slug}`,
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
      content: getInstallContent(params),
    },
  ],
  configure: params => [
    {
      collapsible: true,
      title: t('Manual Configuration'),
      content: [
        {
          type: 'text',
          text: tct(
            'Alternatively, you can also set up the SDK manually, by following the [manualSetupLink:manual setup docs].',
            {
              manualSetupLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/remix/manual-setup/" />
              ),
            }
          ),
        },
        {
          type: 'custom',
          content: <CopyDsnField params={params} />,
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
          text: tct(
            'Start your development server and visit [code:/sentry-example-page] if you have set it up. Click the button to trigger a test error.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'text',
          text: t(
            'Or, trigger a sample error by calling a function that does not exist somewhere in your application.'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Javascript',
              language: 'javascript',
              code: `myUndefinedFunction();`,
            },
          ],
        },
        {
          type: 'text',
          text: t(
            'If you see an issue in your Sentry Issues, you have successfully set up Sentry.'
          ),
        },
      ],
    },
  ],
  nextSteps: () => [],
};

const replayOnboarding: OnboardingConfig = {
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      content: getInstallContent(params),
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getReplayConfigureDescription({
            link: 'https://docs.sentry.io/platforms/javascript/guides/remix/session-replay/',
          }),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              filename: 'entry.client.tsx',
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
        tracePropagationBlock,
        {
          type: 'text',
          text: tct(
            'Note: The Replay integration only needs to be added to your [code:entry.client.tsx] file. It will not run if it is added into [code:sentry.server.config.js].',
            {code: <code />}
          ),
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
      content: [
        {
          type: 'text',
          text: tct(
            'For the User Feedback integration to work, you must have the Sentry browser SDK package, or an equivalent framework SDK (e.g. [code:@sentry/remix]) installed, minimum version 7.85.0.',
            {
              code: <code />,
            }
          ),
        },
        ...getInstallContent(params),
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getFeedbackConfigureDescription({
            linkConfig:
              'https://docs.sentry.io/platforms/javascript/guides/remix/user-feedback/configuration/',
            linkButton:
              'https://docs.sentry.io/platforms/javascript/guides/remix/user-feedback/configuration/#bring-your-own-button',
          }),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              filename: 'entry.client.tsx',
              language: 'javascript',
              code: getFeedbackSDKSetupSnippet({
                importStatement: `import * as Sentry from "@sentry/remix";`,
                dsn: params.dsn.public,
                feedbackOptions: params.feedbackOptions,
              }),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'Note: The Feedback integration only needs to be added to your [code:entry.client.tsx] file.',
            {code: <code />}
          ),
        },
        {
          type: 'custom',
          content: crashReportCallout({
            link: 'https://docs.sentry.io/platforms/javascript/guides/remix/user-feedback/#user-feedback-api',
          }),
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportJavaScriptInstallSteps(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getCrashReportModalConfigDescription({
            link: 'https://docs.sentry.io/platforms/javascript/guides/remix/user-feedback/configuration/#crash-report-modal',
          }),
        },
        widgetCalloutBlock({
          link: 'https://docs.sentry.io/platforms/javascript/guides/remix/user-feedback/#user-feedback-widget',
        }),
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const profilingOnboarding = getJavascriptFullStackOnboarding({
  packageName: '@sentry/remix',
  browserProfilingLink:
    'https://docs.sentry.io/platforms/javascript/guides/remix/profiling/browser-profiling/',
  nodeProfilingLink:
    'https://docs.sentry.io/platforms/javascript/guides/remix/profiling/node-profiling/',
});

const docs: Docs = {
  onboarding,
  feedbackOnboardingNpm: feedbackOnboarding,
  replayOnboarding,
  crashReportOnboarding,
  featureFlagOnboarding,
  profilingOnboarding,
  agentMonitoringOnboarding: getNodeAgentMonitoringOnboarding({
    packageName: '@sentry/remix',
    configFileName: 'instrument.server.mjs',
  }),
  logsOnboarding: getJavascriptLogsFullStackOnboarding({
    docsPlatform: 'remix',
    packageName: '@sentry/remix',
  }),
};

export default docs;

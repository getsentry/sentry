import {Fragment} from 'react';

import crashReportCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/crashReportCallout';
import widgetCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/widgetCallout';
import TracePropagationMessage from 'sentry/components/onboarding/gettingStartedDoc/replay/tracePropagationMessage';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {
  getCrashReportJavaScriptInstallStep,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
  getFeedbackConfigOptions,
  getFeedbackConfigureDescription,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {getJSMetricsOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import {
  getReplayConfigOptions,
  getReplayConfigureDescription,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getSdkSetupSnippet = (params: Params) => `
import * as Sentry from "@sentry/gatsby";

Sentry.init({
  dsn: "${params.dsn}",
  integrations: [${
    params.isPerformanceSelected
      ? `
        Sentry.browserTracingIntegration(),`
      : ''
  }${
    params.isFeedbackSelected
      ? `
        Sentry.feedbackIntegration({
// Additional SDK configuration goes in here, for example:
colorScheme: "system",
${getFeedbackConfigOptions(params.feedbackOptions)}}),`
      : ''
  }${
    params.isReplaySelected
      ? `
        Sentry.replayIntegration(${getReplayConfigOptions(params.replayOptions)}),`
      : ''
  }
],${
  params.isPerformanceSelected
    ? `
      // Performance Monitoring
      tracesSampleRate: 1.0, //  Capture 100% of the transactions
      // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
      tracePropagationTargets: ["localhost", /^https:\\/\\/yourserver\\.io\\/api/],`
    : ''
}${
  params.isReplaySelected
    ? `
      // Session Replay
      replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
      replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.`
    : ''
}
});

const container = document.getElementById(“app”);
const root = createRoot(container);
root.render(<App />);
`;

const getVerifyGatsbySnippet = () => `
myUndefinedFunction();`;

const getConfigureStep = (params: Params) => {
  return {
    type: StepType.CONFIGURE,
    configurations: [
      {
        description: tct(
          'Register the [codeSentry@sentry/gatsby] plugin in your Gatsby configuration file (typically [codeGatsby:gatsby-config.js]).',
          {codeSentry: <code />, codeGatsby: <code />}
        ),
        code: [
          {
            label: 'JavaScript',
            value: 'javascript',
            language: 'javascript',
            code: `module.exports = {
            plugins: [{
              resolve: "@sentry/gatsby",
            }],
          };`,
          },
        ],
      },
      {
        description: tct('Then, configure your [codeSentry:Sentry.init:]', {
          codeSentry: <code />,
        }),
        code: [
          {
            label: 'JavaScript',
            value: 'javascript',
            language: 'javascript',
            code: getSdkSetupSnippet(params),
          },
        ],
      },
    ],
  };
};

const getInstallConfig = () => [
  {
    language: 'bash',
    code: [
      {
        label: 'npm',
        value: 'npm',
        language: 'bash',
        code: 'npm install --save @sentry/gatsby',
      },
      {
        label: 'yarn',
        value: 'yarn',
        language: 'bash',
        code: 'yarn add @sentry/gatsby',
      },
    ],
  },
];

const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Add the Sentry SDK as a dependency using [codeNpm:npm] or [codeYarn:yarn]:',
        {
          codeYarn: <code />,
          codeNpm: <code />,
        }
      ),
      configurations: getInstallConfig(),
    },
  ],
  configure: (params: Params) => [
    getConfigureStep(params),
    getUploadSourceMapsStep({
      guideLink: 'https://docs.sentry.io/platforms/javascript/guides/gatsby/sourcemaps//',
    }),
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t(
        "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
      ),
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getVerifyGatsbySnippet(),
            },
          ],
        },
      ],
    },
  ],
  nextSteps: () => [
    {
      id: 'performance-monitoring',
      name: t('Performance Monitoring'),
      description: t(
        'Track down transactions to connect the dots between 10-second page loads and poor-performing API calls or slow database queries.'
      ),
      link: 'https://docs.sentry.io/platforms/javascript/guides/gatsby/performance/',
    },
    {
      id: 'session-replay',
      name: t('Session Replay'),
      description: t(
        'Get to the root cause of an error or latency issue faster by seeing all the technical details related to that issue in one visual replay on your web application.'
      ),
      link: 'https://docs.sentry.io/platforms/javascript/guides/gatsby/session-replay/',
    },
  ],
};

const replayOnboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'You need a minimum version 7.27.0 of [code:@sentry/gatsby] in order to use Session Replay. You do not need to install any additional packages.',
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
      description: getReplayConfigureDescription({
        link: 'https://docs.sentry.io/platforms/javascript/guides/gatsby/session-replay/',
      }),
      configurations: [getConfigureStep(params)],
      additionalInfo: (
        <Fragment>
          <TracePropagationMessage />
          {tct(
            'Note: If [codeGatsby:gatsby-config.js] has any settings for the [codeSentry:@sentry/gatsby] plugin, they need to be moved into [codeConfig:sentry.config.js]. The [codeGatsby:gatsby-config.js] file does not support non-serializable options, like [codeNew:new Replay()].',
            {
              codeGatsby: <code />,
              codeSentry: <code />,
              codeConfig: <code />,
              codeNew: <code />,
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
        'For the User Feedback integration to work, you must have the Sentry browser SDK package, or an equivalent framework SDK (e.g. [code:@sentry/gatsby]) installed, minimum version 7.85.0.',
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
          'https://docs.sentry.io/platforms/javascript/guides/gatsby/user-feedback/configuration/',
        linkButton:
          'https://docs.sentry.io/platforms/javascript/guides/gatsby/user-feedback/configuration/#bring-your-own-button',
      }),
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
      ],
      additionalInfo: crashReportCallout({
        link: 'https://docs.sentry.io/platforms/javascript/guides/gatsby/user-feedback/#crash-report-modal',
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
        link: 'https://docs.sentry.io/platforms/javascript/guides/gatsby/user-feedback/configuration/#crash-report-modal',
      }),
      additionalInfo: widgetCallout({
        link: 'https://docs.sentry.io/platforms/javascript/guides/gatsby/user-feedback/#user-feedback-widget',
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
  customMetricsOnboarding: getJSMetricsOnboarding({getInstallConfig}),
  crashReportOnboarding,
};

export default docs;

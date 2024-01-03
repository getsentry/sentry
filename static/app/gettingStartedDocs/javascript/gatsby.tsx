import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getReplayConfigOptions,
  getReplayConfigureDescription,
  getUploadSourceMapsStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {getJSMetricsOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getSdkSetupSnippet = (params: Params) => `
import * as Sentry from "@sentry/gatsby";

Sentry.init({
  dsn: "${params.dsn}",
  integrations: [${
    params.isPerformanceSelected
      ? `
        new Sentry.BrowserTracing({
          // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
          tracePropagationTargets: ["localhost", /^https:\\/\\/yourserver\\.io\\/api/],
        }),`
      : ''
  }${
    params.isReplaySelected
      ? `
        new Sentry.Replay(${getReplayConfigOptions(params.replayOptions)}),`
      : ''
  }
],${
  params.isPerformanceSelected
    ? `
      // Performance Monitoring
      tracesSampleRate: 1.0, //  Capture 100% of the transactions`
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
      additionalInfo: tct(
        'Note: If [codeGatsby:gatsby-config.js] has any settings for the [codeSentry:@sentry/gatsby] plugin, they need to be moved into [codeConfig:sentry.config.js]. The [codeGatsby:gatsby-config.js] file does not support non-serializable options, like [codeNew:new Replay()].',
        {
          codeGatsby: <code />,
          codeSentry: <code />,
          codeConfig: <code />,
          codeNew: <code />,
        }
      ),
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

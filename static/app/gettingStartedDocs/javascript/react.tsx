import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
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
  getProfilingDocumentHeaderConfigurationStep,
  MaybeBrowserProfilingBetaWarning,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/profilingOnboarding';
import {
  getReplayConfigOptions,
  getReplayConfigureDescription,
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {featureFlagOnboarding} from 'sentry/gettingStartedDocs/javascript/javascript';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getSdkSetupSnippet = (params: Params) => `
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "${params.dsn.public}",
  integrations: [${
    params.isPerformanceSelected
      ? `
        Sentry.browserTracingIntegration(),`
      : ''
  }${
    params.isProfilingSelected
      ? `
          Sentry.browserProfilingIntegration(),`
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
      // Tracing
      tracesSampleRate: 1.0, //  Capture 100% of the transactions
      // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
      tracePropagationTargets: ["localhost", /^https:\\/\\/yourserver\\.io\\/api/],`
    : ''
}${
  params.isProfilingSelected
    ? `
        // Set profilesSampleRate to 1.0 to profile every transaction.
        // Since profilesSampleRate is relative to tracesSampleRate,
        // the final profiling rate can be computed as tracesSampleRate * profilesSampleRate
        // For example, a tracesSampleRate of 0.5 and profilesSampleRate of 0.5 would
        // results in 25% of transactions being profiled (0.5*0.5=0.25)
        profilesSampleRate: 1.0,`
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

const getVerifySnippet = () => `
return <button onClick={() => {throw new Error("This is your first error!");}}>Break the world</button>;
`;

const getInstallConfig = () => [
  {
    language: 'bash',
    code: [
      {
        label: 'npm',
        value: 'npm',
        language: 'bash',
        code: 'npm install --save @sentry/react',
      },
      {
        label: 'yarn',
        value: 'yarn',
        language: 'bash',
        code: 'yarn add @sentry/react',
      },
    ],
  },
];

const onboarding: OnboardingConfig = {
  introduction: params => (
    <Fragment>
      <MaybeBrowserProfilingBetaWarning {...params} />
      <p>
        {tct('In this quick guide you’ll use [strong:npm] or [strong:yarn] to set up:', {
          strong: <strong />,
        })}
      </p>
    </Fragment>
  ),
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Add the Sentry SDK as a dependency using [code:npm] or [code:yarn]:',
        {code: <code />}
      ),
      configurations: getInstallConfig(),
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: t(
        "Initialize Sentry as early as possible in your application's lifecycle."
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
        ...(params.isProfilingSelected
          ? [getProfilingDocumentHeaderConfigurationStep()]
          : []),
      ],
    },
    getUploadSourceMapsStep({
      guideLink: 'https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/',
      ...params,
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
              label: 'React',
              value: 'react',
              language: 'javascript',
              code: getVerifySnippet(),
            },
          ],
        },
      ],
    },
  ],
  nextSteps: () => [
    {
      id: 'react-features',
      name: t('React Features'),
      description: t('Learn about our first class integration with the React framework.'),
      link: 'https://docs.sentry.io/platforms/javascript/guides/react/features/',
    },
    {
      id: 'react-router',
      name: t('React Router'),
      description: t(
        'Configure routing, so Sentry can generate parameterized transaction names for a better overview on the Performance page.'
      ),
      link: 'https://docs.sentry.io/platforms/javascript/guides/react/configuration/integrations/react-router/',
    },
  ],
};

const replayOnboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Add the Sentry SDK as a dependency using [code:npm] or [code:yarn]. You need a minimum version 7.27.0 of [code:@sentry/react] in order to use Session Replay. You do not need to install any additional packages.',
        {code: <code />}
      ),
      configurations: getInstallConfig(),
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: getReplayConfigureDescription({
        link: 'https://docs.sentry.io/platforms/javascript/guides/react/session-replay/',
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
          additionalInfo: <TracePropagationMessage />,
        },
      ],
    },
  ],
  verify: getReplayVerifyStep(),
  nextSteps: () => [],
};

const feedbackOnboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'For the User Feedback integration to work, you must have the Sentry browser SDK package, or an equivalent framework SDK (e.g. [code:@sentry/react]) installed, minimum version 7.85.0.',
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
          'https://docs.sentry.io/platforms/javascript/guides/react/user-feedback/configuration/',
        linkButton:
          'https://docs.sentry.io/platforms/javascript/guides/react/user-feedback/configuration/#bring-your-own-button',
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
        link: 'https://docs.sentry.io/platforms/javascript/guides/react/user-feedback/#crash-report-modal',
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
        link: 'https://docs.sentry.io/platforms/javascript/guides/react/user-feedback/configuration/#crash-report-modal',
      }),
      additionalInfo: widgetCallout({
        link: 'https://docs.sentry.io/platforms/javascript/guides/react/user-feedback/#user-feedback-widget',
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
  install: onboarding.install,
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: t(
        "Configuration should happen as early as possible in your application's lifecycle."
      ),
      configurations: [
        {
          language: 'javascript',
          code: `
import React from "react";
import ReactDOM from "react-dom";
import * as Sentry from "@sentry/react";
import App from "./App";

Sentry.init({
  dsn: "${params.dsn.public}",
  integrations: [Sentry.browserTracingIntegration()],

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
  // Set \`tracePropagationTargets\` to control for which URLs distributed tracing should be enabled
  tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],
});

ReactDOM.render(<App />, document.getElementById("root"));

// Can also use with React Concurrent Mode
// ReactDOM.createRoot(document.getElementById('root')).render(<App />);
`,
          additionalInfo: tct(
            'We recommend adjusting the value of [code:tracesSampleRate] in production. Learn more about tracing [linkTracingOptions:options], how to use the [linkTracesSampler:traces_sampler] function, or how to [linkSampleTransactions:sample transactions].',
            {
              code: <code />,
              linkTracingOptions: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/react/configuration/options/#tracing-options" />
              ),
              linkTracesSampler: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/react/configuration/sampling/" />
              ),
              linkSampleTransactions: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/react/configuration/sampling/" />
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
        'Verify that performance monitoring is working correctly with our [link:automatic instrumentation] by simply using your React application.',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/react/tracing/instrumentation/automatic-instrumentation/" />
          ),
        }
      ),
      configurations: [
        {
          description: tct(
            'You have the option to manually construct a transaction using [link:custom instrumentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/react/tracing/instrumentation/custom-instrumentation/" />
              ),
            }
          ),
          language: 'javascript',
          code: `
const transaction = Sentry.startTransaction({ name: "test-transaction" });
const span = transaction.startChild({ op: "functionX" }); // This function returns a Span
// exampleFunctionCall();
span.finish(); // Remember that only finished spans will be sent with the transaction
transaction.finish(); // Finishing the transaction will send it to Sentry`,
        },
        {
          description: tct(
            'In addition, [code:@sentry/react] exports a [code:withProfiler] higher order component that can be used to capture React-related spans for specific React components:',
            {code: <code />}
          ),
          language: 'javascript',
          code: `
import * as Sentry from "@sentry/react";

function App(props) {
  return <div />;
}

export default Sentry.withProfiler(App);
`,
          additionalInfo: tct(
            'Learn more about the profiler in [link:React Component Tracking].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/react/features/component-tracking/" />
              ),
            }
          ),
        },
      ],
    },
  ],
  nextSteps: () => [],
};

const profilingOnboarding: OnboardingConfig = {
  ...onboarding,
  introduction: params => <MaybeBrowserProfilingBetaWarning {...params} />,
};

const docs: Docs = {
  onboarding,
  feedbackOnboardingNpm: feedbackOnboarding,
  replayOnboarding,
  customMetricsOnboarding: getJSMetricsOnboarding({getInstallConfig}),
  performanceOnboarding,
  crashReportOnboarding,
  profilingOnboarding,
  featureFlagOnboarding,
};

export default docs;

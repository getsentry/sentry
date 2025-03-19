import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {buildSdkConfig} from 'sentry/components/onboarding/gettingStartedDoc/buildSdkConfig';
import crashReportCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/crashReportCallout';
import widgetCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/widgetCallout';
import TracePropagationMessage from 'sentry/components/onboarding/gettingStartedDoc/replay/tracePropagationMessage';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
  PlatformOption,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportJavaScriptInstallStep,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
  getFeedbackConfigOptions,
  getFeedbackConfigureDescription,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
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

export enum RouterType {
  REACT_ROUTER = 'reactRouter',
  TANSTACK_ROUTER = 'tanstackRouter',
  NO_ROUTER = 'noRouter',
}

export enum ReactRouterVersion {
  V7 = 'v7',
  V6 = 'v6',
  V5 = 'v5',
  V4 = 'v4',
  V3 = 'v3',
}

type PlatformOptionKey = 'routerType' | 'reactRouterVersion';

const platformOptions: Record<PlatformOptionKey, PlatformOption> = {
  routerType: {
    label: t('Router'),
    items: [
      {
        label: t('React Router'),
        value: RouterType.REACT_ROUTER,
      },
      {
        label: t('Tanstack Router'),
        value: RouterType.TANSTACK_ROUTER,
      },
      {
        label: t('No Router'),
        value: RouterType.NO_ROUTER,
      },
    ],
  },
  reactRouterVersion: {
    label: t('React Router Version'),
    items: [
      {
        label: t('v7 (Latest)'),
        value: ReactRouterVersion.V7,
      },
      {
        label: t('v6'),
        value: ReactRouterVersion.V6,
      },
      {
        label: t('v5'),
        value: ReactRouterVersion.V5,
      },
      {
        label: t('v4'),
        value: ReactRouterVersion.V4,
      },
      {
        label: t('v3'),
        value: ReactRouterVersion.V3,
      },
    ],
  },
};

type PlatformOptions = typeof platformOptions;
type Params = DocsParams<PlatformOptions>;

const getRouterIntegrationSnippet = (params: Params): string => {
  if (!params.isPerformanceSelected) {
    return '';
  }

  const routerType = params.platformOptions.routerType;
  const reactRouterVersion = params.platformOptions.reactRouterVersion;

  if (routerType === RouterType.NO_ROUTER) {
    return 'Sentry.browserTracingIntegration(),';
  }

  if (routerType === RouterType.TANSTACK_ROUTER) {
    return `Sentry.tanstackRouterBrowserTracingIntegration(),`;
  }

  // React Router integration
  switch (reactRouterVersion) {
    case ReactRouterVersion.V7:
      return `Sentry.reactRouterV7BrowserTracingIntegration({
          useEffect: React.useEffect,
          useLocation,
          useNavigationType,
          createRoutesFromChildren,
          matchRoutes,
        }),`;
    case ReactRouterVersion.V6:
      return `Sentry.reactRouterV6BrowserTracingIntegration({
          useEffect: React.useEffect,
          useLocation,
          useNavigationType,
          createRoutesFromChildren,
          matchRoutes,
        }),`;
    case ReactRouterVersion.V5:
      return `Sentry.reactRouterV5BrowserTracingIntegration({
          history,
        }),`;
    case ReactRouterVersion.V4:
      return `Sentry.reactRouterV4BrowserTracingIntegration({
          history,
        }),`;
    case ReactRouterVersion.V3:
      return `Sentry.reactRouterV3BrowserTracingIntegration({
          history: Router.browserHistory,
          routes: Router.createRoutes(routes),
          match: Router.match,
        }),`;
    default:
      return 'Sentry.browserTracingIntegration(),';
  }
};

const getRouterImportSnippet = (params: Params): string => {
  if (!params.isPerformanceSelected) {
    return '';
  }

  const routerType = params.platformOptions.routerType;
  const reactRouterVersion = params.platformOptions.reactRouterVersion;

  if (routerType === RouterType.NO_ROUTER) {
    return '';
  }

  if (routerType === RouterType.TANSTACK_ROUTER) {
    return `import { Router } from '@tanstack/router';`;
  }

  // React Router imports
  switch (reactRouterVersion) {
    case ReactRouterVersion.V7:
    case ReactRouterVersion.V6:
      return `import {
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes
} from "react-router-dom";`;
    case ReactRouterVersion.V5:
    case ReactRouterVersion.V4:
      return `import { Router } from 'react-router-dom';
import { createBrowserHistory } from 'history';
const history = createBrowserHistory();`;
    case ReactRouterVersion.V3:
      return `import * as Router from "react-router";`;
    default:
      return '';
  }
};

const getSdkSetupSnippet = (params: Params) => {
  const routerImports = getRouterImportSnippet(params);
  const routerIntegration = getRouterIntegrationSnippet(params);

  return `
${routerImports ? `${routerImports}\n` : ''}import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "${params.dsn.public}",
  integrations: [${
    params.isPerformanceSelected
      ? `
        ${routerIntegration}`
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

const container = document.getElementById("app");
const root = createRoot(container);
root.render(<App />);
`;
};

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

const getSourceMapsStep = (params: Params) => {
  const urlParam = params.isSelfHosted ? '' : '--saas';
  const orgSlug = params.organization.slug;
  const projectSlug = params.projectSlug;

  return {
    type: StepType.CONFIGURE,
    description: t(
      'Source maps help Sentry show you the exact line of code that caused an error.'
    ),
    configurations: [
      {
        language: 'bash',
        code: `npx @sentry/wizard@latest -i sourcemaps ${urlParam} --org ${orgSlug} --project ${projectSlug}`,
        description: t(
          'Run the Sentry source maps wizard to set up source maps for your project:'
        ),
      },
    ],
    additionalDetails: (
      <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/">
        {t('Learn more about source maps')}
      </ExternalLink>
    ),
  };
};

const onboarding: OnboardingConfig<PlatformOptions> = {
  introduction: params => (
    <Fragment>
      <MaybeBrowserProfilingBetaWarning {...params} />
      <p>
        {tct("In this quick guide you'll use [strong:npm] or [strong:yarn] to set up:", {
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
          additionalInfo: <TracePropagationMessage />,
        },
        ...(params.isProfilingSelected
          ? [getProfilingDocumentHeaderConfigurationStep()]
          : []),
      ],
    },
    getSourceMapsStep(params),
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
  nextSteps: params => {
    const nextSteps = [
      {
        id: 'react-features',
        name: t('React Features'),
        description: t(
          'Learn about our first class integration with the React framework.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/react/features/',
      },
    ];

    if (
      params?.isPerformanceSelected &&
      params?.platformOptions?.routerType === RouterType.REACT_ROUTER
    ) {
      nextSteps.push({
        id: 'react-router',
        name: t('React Router'),
        description: t(
          'Configure routing, so Sentry can generate parameterized transaction names for a better overview on the Performance page.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/react/configuration/integrations/react-router/',
      });
    }

    return nextSteps;
  },
};

const replayOnboarding: OnboardingConfig<PlatformOptions> = {
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
        },
      ],
    },
  ],
  verify: getReplayVerifyStep(),
  nextSteps: () => [],
};

const feedbackOnboarding: OnboardingConfig<PlatformOptions> = {
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

const crashReportOnboarding: OnboardingConfig<PlatformOptions> = {
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

const performanceOnboarding: OnboardingConfig<PlatformOptions> = {
  introduction: () =>
    t(
      "Adding Performance to your React project is simple. Make sure you've got these basics down."
    ),
  install: onboarding.install,
  configure: params => [
    {
      type: StepType.CONFIGURE,
      configurations: [
        {
          language: 'javascript',
          description: t(
            "Configuration should happen as early as possible in your application's lifecycle."
          ),
          code: getSdkSetupSnippet(params),
          additionalInfo: tct(
            'We recommend adjusting the value of [code:tracesSampleRate] in production. Learn more about tracing [linkTracingOptions:options], how to use the [linkTracesSampler:traces_sampler] function, or how to do [linkSampleTransactions:sampling].',
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
    },
  ],
  nextSteps: () => [],
};

const profilingOnboarding: OnboardingConfig<PlatformOptions> = {
  ...onboarding,
  introduction: params => <MaybeBrowserProfilingBetaWarning {...params} />,
};

const docs: Docs<PlatformOptions> = {
  onboarding,
  platformOptions,
  feedbackOnboardingNpm: feedbackOnboarding,
  replayOnboarding,

  performanceOnboarding,
  crashReportOnboarding,
  profilingOnboarding,
  featureFlagOnboarding,
};

export default docs;

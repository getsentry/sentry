import {IntegrationOptions} from 'sentry/components/events/featureFlags/utils';
import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  type Docs,
  DocsPageLocation,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportBackendInstallStep,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {getPythonMetricsOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

type FlagImports = {
  integration: string; // what's in the integrations array
  module: string; // what's imported from sentry_sdk.integrations
};

const FLAG_OPTION_TO_IMPORT: Record<IntegrationOptions, FlagImports> = {
  [IntegrationOptions.LAUNCHDARKLY]: {
    module: 'integrations.launchdarkly',
    integration: 'LaunchDarklyIntegration',
  },
  [IntegrationOptions.OPENFEATURE]: {
    module: 'integrations.openfeature',
    integration: 'OpenFeatureIntegration',
  },
  [IntegrationOptions.UNLEASH]: {
    module: 'integrations.unleash',
    integration: 'UnleashIntegration',
  },
  [IntegrationOptions.GENERIC]: {
    module: 'feature_flags',
    integration: '',
  },
};

const getInstallSnippet = () => `pip install --upgrade sentry-sdk`;

const getSdkSetupSnippet = (params: Params) => `
import sentry_sdk

sentry_sdk.init(
    dsn="${params.dsn.public}",${
      params.isPerformanceSelected
        ? `
    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for tracing.
    traces_sample_rate=1.0,`
        : ''
    }${
      params.isProfilingSelected &&
      params.profilingOptions?.defaultProfilingMode !== 'continuous'
        ? `
    # Set profiles_sample_rate to 1.0 to profile 100%
    # of sampled transactions.
    # We recommend adjusting this value in production.
    profiles_sample_rate=1.0,`
        : ''
    }
)${
  params.isProfilingSelected &&
  params.profilingOptions?.defaultProfilingMode === 'continuous'
    ? `

def slow_function():
    import time
    time.sleep(0.1)
    return "done"

def fast_function():
    import time
    time.sleep(0.05)
    return "done"

# Manually call start_profiler and stop_profiler
# to profile the code in between
sentry_sdk.profiler.start_profiler()
for i in range(0, 10):
    slow_function()
    fast_function()
#
# Calls to stop_profiler are optional - if you don't stop the profiler, it will keep profiling
# your application until the process exits or stop_profiler is called.
sentry_sdk.profiler.stop_profiler()`
    : ''
}`;

const onboarding: OnboardingConfig = {
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      description: tct('Install our Python SDK using [code:pip]:', {
        code: <code />,
      }),
      configurations: [
        {
          description:
            params.docsLocation === DocsPageLocation.PROFILING_PAGE
              ? tct(
                  'You need a minimum version [code:1.18.0] of the [code:sentry-python] SDK for the profiling feature.',
                  {
                    code: <code />,
                  }
                )
              : undefined,
          language: 'bash',
          code: getInstallSnippet(),
        },
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: t(
        "Import and initialize the Sentry SDK early in your application's setup:"
      ),
      configurations: [
        {
          language: 'python',
          code: getSdkSetupSnippet(params),
        },
      ],
      additionalInfo: params.isProfilingSelected &&
        params.profilingOptions?.defaultProfilingMode === 'continuous' && (
          <AlternativeConfiguration />
        ),
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t(
        'One way to verify your setup is by intentionally causing an error that breaks your application.'
      ),
      configurations: [
        {
          language: 'python',
          description: t(
            'Raise an unhandled Python exception by inserting a divide by zero expression into your application:'
          ),
          code: 'division_by_zero = 1 / 0',
        },
      ],
    },
  ],
};

export const crashReportOnboardingPython: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportBackendInstallStep(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getCrashReportModalConfigDescription({
        link: 'https://docs.sentry.io/platforms/python/user-feedback/configuration/#crash-report-modal',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

export const performanceOnboarding: OnboardingConfig = {
  introduction: () =>
    t(
      "Adding Performance to your Python project is simple. Make sure you've got these basics down."
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
          description: tct(
            "Once this is done, Sentry's Python SDK captures all unhandled exceptions and transactions. Note that [code:enable_tracing] is available in Sentry Python SDK version [code:≥ 1.16.0]. To enable tracing in older SDK versions ([code:≥ 0.11.2]), use [code:traces_sample_rate=1.0].",
            {code: <code />}
          ),
          language: 'python',
          code: `
import sentry_sdk

sentry_sdk.init(
  dsn="${params.dsn.public}",
  enable_tracing=True,
)`,
          additionalInfo: tct(
            'Learn more about tracing [linkTracingOptions:options], how to use the [linkTracesSampler:traces_sampler] function, or how to [linkSampleTransactions:sample transactions].',
            {
              linkTracingOptions: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/configuration/options/#tracing-options" />
              ),
              linkTracesSampler: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/configuration/sampling/" />
              ),
              linkSampleTransactions: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/configuration/sampling/" />
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
        'Verify that performance monitoring is working correctly with our [link:automatic instrumentation] by simply using your Python application.',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/python/tracing/instrumentation/automatic-instrumentation/" />
          ),
        }
      ),
      additionalInfo: tct(
        'You have the option to manually construct a transaction using [link:custom instrumentation].',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/python/tracing/instrumentation/custom-instrumentation/" />
          ),
        }
      ),
    },
  ],
  nextSteps: () => [],
};

export function AlternativeConfiguration() {
  return (
    <div>
      {tct(
        'Alternatively, you can also explicitly control continuous profiling or use transaction profiling. See our [link:documentation] for more information.',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/python/profiling/" />
          ),
        }
      )}
    </div>
  );
}

export const featureFlagOnboarding: OnboardingConfig = {
  install: () => [],
  configure: ({featureFlagOptions = {integration: ''}, dsn}) => [
    {
      type: StepType.CONFIGURE,
      description:
        featureFlagOptions.integration === IntegrationOptions.GENERIC
          ? `This provider doesn't use an integration. Simply initialize Sentry and import the API.`
          : tct('Add [name] to your integrations list.', {
              name: (
                <code>{`${FLAG_OPTION_TO_IMPORT[featureFlagOptions.integration as keyof typeof FLAG_OPTION_TO_IMPORT].integration}()`}</code>
              ),
            }),
      configurations: [
        {
          language: 'python',
          code:
            featureFlagOptions.integration === IntegrationOptions.GENERIC
              ? `import sentry_sdk
from sentry_sdk.${FLAG_OPTION_TO_IMPORT[featureFlagOptions.integration].module} import add_feature_flag

sentry_sdk.init(
  dsn="${dsn.public}",
  integrations=[
    # your other integrations here
  ]
)`
              : `import sentry_sdk
from sentry_sdk.${FLAG_OPTION_TO_IMPORT[featureFlagOptions.integration as keyof typeof FLAG_OPTION_TO_IMPORT].module} import ${FLAG_OPTION_TO_IMPORT[featureFlagOptions.integration as keyof typeof FLAG_OPTION_TO_IMPORT].integration}

sentry_sdk.init(
  dsn="${dsn.public}",
  integrations=[
    ${FLAG_OPTION_TO_IMPORT[featureFlagOptions.integration as keyof typeof FLAG_OPTION_TO_IMPORT].integration}(),
  ]
)`,
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  performanceOnboarding,
  customMetricsOnboarding: getPythonMetricsOnboarding({
    installSnippet: getInstallSnippet(),
  }),
  crashReportOnboarding: crashReportOnboardingPython,
  featureFlagOnboarding,
};

export default docs;

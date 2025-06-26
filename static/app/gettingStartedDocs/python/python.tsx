import {Alert} from 'sentry/components/core/alert';
import {SdkProviderEnum as FeatureFlagProviderEnum} from 'sentry/components/events/featureFlags/utils';
import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  type Docs,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportBackendInstallStep,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {t, tct} from 'sentry/locale';
import {
  getPythonInstallConfig,
  getPythonProfilingOnboarding,
} from 'sentry/utils/gettingStartedDocs/python';

type Params = DocsParams;

type FeatureFlagConfiguration = {
  integrationName: string;
  makeConfigureCode: (dsn: string) => string;
  makeVerifyCode: () => string;
  packageName: string;
};

const FEATURE_FLAG_CONFIGURATION_MAP: Record<
  FeatureFlagProviderEnum,
  FeatureFlagConfiguration
> = {
  [FeatureFlagProviderEnum.GENERIC]: {
    integrationName: ``,
    packageName: 'sentry-sdk',
    makeConfigureCode: (dsn: string) => `sentry_sdk.init(
    dsn="${dsn}",
    # Add data like request headers and IP for users, if applicable;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
    integrations=[
        # your other integrations here
    ],
)`,
    makeVerifyCode: () => `import sentry_sdk
from sentry_sdk.feature_flags import add_feature_flag

add_feature_flag('test-flag', False)  # Records an evaluation and its result.
sentry_sdk.capture_exception(Exception("Something went wrong!"))`,
  },

  [FeatureFlagProviderEnum.LAUNCHDARKLY]: {
    integrationName: `LaunchDarklyIntegration`,
    packageName: "'sentry-sdk[launchdarkly]'",
    makeConfigureCode: (dsn: string) => `import sentry_sdk
from sentry_sdk.integrations.launchdarkly import LaunchDarklyIntegration
import ldclient

sentry_sdk.init(
    dsn="${dsn}",
    # Add data like request headers and IP for users, if applicable;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
    integrations=[
        LaunchDarklyIntegration(),
    ],
)`,
    makeVerifyCode: () => `client = ldclient.get()
client.variation("hello", Context.create("test-context"), False)  # Evaluate a flag with a default value.
sentry_sdk.capture_exception(Exception("Something went wrong!"))`,
  },

  [FeatureFlagProviderEnum.OPENFEATURE]: {
    integrationName: `OpenFeatureIntegration`,
    packageName: "'sentry-sdk[openfeature]'",
    makeConfigureCode: (dsn: string) => `import sentry_sdk
from sentry_sdk.integrations.openfeature import OpenFeatureIntegration
from openfeature import api

sentry_sdk.init(
    dsn="${dsn}",
    # Add data like request headers and IP for users, if applicable;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
    integrations=[
        OpenFeatureIntegration(),
    ],
)`,
    makeVerifyCode: () => `client = api.get_client()
client.get_boolean_value("hello", default_value=False)  # Evaluate a flag with a default value.
sentry_sdk.capture_exception(Exception("Something went wrong!"))`,
  },

  [FeatureFlagProviderEnum.STATSIG]: {
    integrationName: `StatsigIntegration`,
    packageName: "'sentry-sdk[statsig]'",
    makeConfigureCode: (dsn: string) => `import sentry_sdk
from sentry_sdk.integrations.statsig import StatsigIntegration
from statsig.statsig_user import StatsigUser
from statsig import statsig
import time

sentry_sdk.init(
    dsn="${dsn}",
    # Add data like request headers and IP for users, if applicable;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
    integrations=[StatsigIntegration()],
)
statsig.initialize("server-secret-key")`,
    makeVerifyCode: () => `while not statsig.is_initialized():
    time.sleep(0.2)

result = statsig.check_gate(StatsigUser("my-user-id"), "my-feature-gate")  # Evaluate a flag.
sentry_sdk.capture_exception(Exception("Something went wrong!"))`,
  },

  [FeatureFlagProviderEnum.UNLEASH]: {
    integrationName: `UnleashIntegration`,
    packageName: "'sentry-sdk[unleash]'",
    makeConfigureCode: (dsn: string) => `import sentry_sdk
from sentry_sdk.integrations.unleash import UnleashIntegration
from UnleashClient import UnleashClient

sentry_sdk.init(
    dsn="${dsn}",
    # Add data like request headers and IP for users, if applicable;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
    integrations=[UnleashIntegration()],
)

unleash = UnleashClient(...)  # See Unleash quickstart.
unleash.initialize_client()`,
    makeVerifyCode:
      () => `test_flag_enabled = unleash.is_enabled("test-flag")  # Evaluate a flag.
sentry_sdk.capture_exception(Exception("Something went wrong!"))`,
  },
};

const getSdkSetupSnippet = (params: Params) => `
import sentry_sdk

sentry_sdk.init(
    dsn="${params.dsn.public}",
    # Add data like request headers and IP for users,
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,${
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
        : params.isProfilingSelected &&
            params.profilingOptions?.defaultProfilingMode === 'continuous'
          ? `
    # Set profile_session_sample_rate to 1.0 to profile 100%
    # of profile sessions.
    profile_session_sample_rate=1.0,`
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

# Calls to stop_profiler are optional - if you don't stop the profiler, it will keep profiling
# your application until the process exits or stop_profiler is called.
sentry_sdk.profiler.stop_profiler()`
    : ''
}`;

const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct('Install our Python SDK:', {
        code: <code />,
      }),
      configurations: getPythonInstallConfig(),
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
            "Once this is done, Sentry's Python SDK captures all unhandled exceptions and transactions. To enable tracing, use [code:traces_sample_rate=1.0] in the sentry_sdk.init() call.",
            {code: <code />}
          ),
          language: 'python',
          code: `
import sentry_sdk

sentry_sdk.init(
    dsn="${params.dsn.public}",
    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for tracing.
    traces_sample_rate=1.0,
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
  configure: ({featureFlagOptions = {integration: ''}, dsn}) => {
    const {integrationName, packageName, makeConfigureCode, makeVerifyCode} =
      FEATURE_FLAG_CONFIGURATION_MAP[
        featureFlagOptions.integration as keyof typeof FEATURE_FLAG_CONFIGURATION_MAP
      ];

    return [
      {
        type: StepType.INSTALL,
        description:
          featureFlagOptions.integration === FeatureFlagProviderEnum.GENERIC
            ? t('Install the Sentry SDK.')
            : t('Install the Sentry SDK with an extra.'),
        configurations: getPythonInstallConfig({
          packageName,
        }),
      },
      {
        type: StepType.CONFIGURE,
        description:
          featureFlagOptions.integration === FeatureFlagProviderEnum.GENERIC
            ? `You don't need an integration for a generic usecase. Simply use this API after initializing Sentry.`
            : tct('Add [name] to your integrations list.', {
                name: <code>{`${integrationName}`}</code>,
              }),
        configurations: [
          {
            language: 'python',
            code: makeConfigureCode(dsn.public),
          },
        ],
      },
      {
        type: StepType.VERIFY,
        description: t(
          'Test your setup by evaluating a flag, then capturing an exception. Check the Feature Flags table in Issue Details to confirm that your error event has recorded the flag and its result.'
        ),
        configurations: [
          {
            language: 'python',
            code: makeVerifyCode(),
          },
        ],
      },
    ];
  },
  verify: () => [],
  nextSteps: () => [],
};

export const agentMonitoringOnboarding: OnboardingConfig = {
  introduction: () => (
    <Alert type="info">
      {tct(
        'Agent Monitoring is currently in beta with support for [vercelai:Vercel AI SDK] and [openai:OpenAI Agents SDK].',
        {
          vercelai: (
            <ExternalLink href="https://docs.sentry.io/product/insights/agents/getting-started/#quick-start-with-vercel-ai-sdk" />
          ),
          openai: (
            <ExternalLink href="https://docs.sentry.io/product/insights/agents/getting-started/#quick-start-with-openai-agents" />
          ),
        }
      )}
    </Alert>
  ),
  install: () => [
    {
      type: StepType.INSTALL,
      description: t('Install our Python SDK:'),
      configurations: getPythonInstallConfig(),
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'Import and initialize the Sentry SDK with the [openai:OpenAI Agents] integration:',
        {
          openai: (
            <ExternalLink href="https://docs.sentry.io/product/insights/agents/getting-started/#quick-start-with-openai-agents" />
          ),
        }
      ),
      configurations: [
        {
          code: [
            {
              label: 'Python',
              value: 'python',
              language: 'python',
              code: `
import sentry_sdk
from sentry_sdk.integrations.openai_agents import OpenAIAgentsIntegration

sentry_sdk.init(
    dsn="${params.dsn.public}",
    # Add data like inputs and responses to/from LLMs and tools;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
    integrations=[
        OpenAIAgentsIntegration(),
    ],
)`,
            },
          ],
        },
      ],
      additionalInfo: t(
        'The OpenAI Agents integration will automatically collect information about agents, tools, prompts, tokens, and models.'
      ),
    },
  ],
  verify: () => [],
};

const docs: Docs = {
  onboarding,
  performanceOnboarding,
  crashReportOnboarding: crashReportOnboardingPython,
  featureFlagOnboarding,
  profilingOnboarding: getPythonProfilingOnboarding({traceLifecycle: 'manual'}),
  agentMonitoringOnboarding,
};

export default docs;

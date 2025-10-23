import {ExternalLink} from 'sentry/components/core/link';
import {SdkProviderEnum as FeatureFlagProviderEnum} from 'sentry/components/events/featureFlags/utils';
import {
  StepType,
  type Docs,
  type DocsParams,
  type OnboardingConfig,
  type OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportBackendInstallSteps,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {t, tct} from 'sentry/locale';
import {
  alternativeProfilingConfiguration,
  getPythonInstallCodeBlock,
  getPythonLogsOnboarding,
  getPythonProfilingOnboarding,
  getVerifyLogsContent,
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
      params.isLogsSelected
        ? `
    # Enable sending logs to Sentry
    enable_logs=True,`
        : ''
    }${
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
      content: [
        {
          type: 'text',
          text: tct('Install our Python SDK:', {
            code: <code />,
          }),
        },
        getPythonInstallCodeBlock(),
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: t(
            "Import and initialize the Sentry SDK early in your application's setup:"
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: getSdkSetupSnippet(params),
        },
        alternativeProfilingConfiguration(params),
      ],
    },
  ],
  verify: (params: Params) => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'You can verify your setup by intentionally causing an error that breaks your application:'
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: 'division_by_zero = 1 / 0',
        },
        getVerifyLogsContent(params),
      ],
    },
  ],
  nextSteps: (params: Params) => {
    const steps = [];

    if (params.isLogsSelected) {
      steps.push({
        id: 'logs',
        name: t('Logging Integrations'),
        description: t(
          'Add logging integrations to automatically capture logs from your application.'
        ),
        link: 'https://docs.sentry.io/platforms/python/logs/#integrations',
      });
    }

    return steps;
  },
};

export const crashReportOnboardingPython: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportBackendInstallSteps(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getCrashReportModalConfigDescription({
            link: 'https://docs.sentry.io/platforms/python/user-feedback/configuration/#crash-report-modal',
          }),
        },
      ],
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
      content: [
        {
          type: 'text',
          text: t(
            "Configuration should happen as early as possible in your application's lifecycle."
          ),
        },
        {
          type: 'text',
          text: tct(
            "Once this is done, Sentry's Python SDK captures all unhandled exceptions and transactions. To enable tracing, use [code:traces_sample_rate=1.0] in the sentry_sdk.init() call.",
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `
import sentry_sdk

sentry_sdk.init(
    dsn="${params.dsn.public}",
    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for tracing.
    traces_sample_rate=1.0,
)`,
        },
        {
          type: 'text',
          text: tct(
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
      content: [
        {
          type: 'text',
          text: tct(
            'Verify that performance monitoring is working correctly with our [link:automatic instrumentation] by simply using your Python application.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/tracing/instrumentation/automatic-instrumentation/" />
              ),
            }
          ),
        },
        {
          type: 'text',
          text: tct(
            'You have the option to manually construct a transaction using [link:custom instrumentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/tracing/instrumentation/custom-instrumentation/" />
              ),
            }
          ),
        },
      ],
    },
  ],
  nextSteps: () => [],
};

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
        content: [
          {
            type: 'text',
            text:
              featureFlagOptions.integration === FeatureFlagProviderEnum.GENERIC
                ? t('Install the Sentry SDK.')
                : t('Install the Sentry SDK with an extra.'),
          },
          getPythonInstallCodeBlock({packageName}),
        ],
      },
      {
        type: StepType.CONFIGURE,
        content: [
          {
            type: 'text',
            text:
              featureFlagOptions.integration === FeatureFlagProviderEnum.GENERIC
                ? `You don't need an integration for a generic usecase. Simply use this API after initializing Sentry.`
                : tct('Add [name] to your integrations list.', {
                    name: <code>{`${integrationName}`}</code>,
                  }),
          },
          {
            type: 'code',
            language: 'python',
            code: makeConfigureCode(dsn.public),
          },
        ],
      },
      {
        type: StepType.VERIFY,
        content: [
          {
            type: 'text',
            text: t(
              'Test your setup by evaluating a flag, then capturing an exception. Check the Feature Flags table in Issue Details to confirm that your error event has recorded the flag and its result.'
            ),
          },
          {
            type: 'code',
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

export const mcpOnboarding: OnboardingConfig = {
  install: () => {
    const packageName = 'sentry-sdk[mcp]';

    return [
      {
        type: StepType.INSTALL,
        content: [
          {
            type: 'text',
            text: t(
              'To enable MCP monitoring, you need to install the Sentry SDK with a minimum version of 2.43.0 or higher.'
            ),
          },
          getPythonInstallCodeBlock({packageName}),
        ],
      },
    ];
  },
  configure: (params: Params) => {
    const mcpLowLevelStep: OnboardingStep = {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: t('Configure Sentry for MCP low-level monitoring:'),
        },
        {
          type: 'code',
          language: 'python',
          code: `
import sentry_sdk
from sentry_sdk.integrations.mcp import MCPIntegration

sentry_sdk.init(
    dsn="${params.dsn.public}",
    traces_sample_rate=1.0,
    # Add data like inputs and responses to/from MCP servers;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
    integrations=[
        MCPIntegration(),
    ],
)`,
        },
        {
          type: 'text',
          text: t('Set up your low-level MCP server:'),
        },
        {
          type: 'code',
          language: 'python',
          code: `
from mcp.server.lowlevel import Server
from mcp.types import Tool, TextContent

server = Server("mcp-server")

@server.list_tools()
async def list_tools() -> list[Tool]:
    """List all available tools."""
    return [
        Tool(
            name="calculate_sum",
            description="Add two numbers together",
            inputSchema={
                "type": "object",
                "properties": {
                    "a": {"type": "number", "description": "First number"},
                    "b": {"type": "number", "description": "Second number"},
                },
                "required": ["a", "b"],
            },
        )
    ]
@server.call_tool()
async def call_tool(name: str, arguments) -> list[TextContent]:
    """Handle tool execution based on tool name."""

    if name == "calculate_sum":
        a = arguments.get("a", 0)
        b = arguments.get("b", 0)
        result = a + b
        return [TextContent(type="text", text=f"The sum of {a} and {b} is {result}")]

`,
        },
      ],
    };

    const mcpFastMcpStep: OnboardingStep = {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: t('Configure Sentry for MCP low-level monitoring:'),
        },
        {
          type: 'code',
          language: 'python',
          code: `
import sentry_sdk
from sentry_sdk.integrations.mcp import MCPIntegration

sentry_sdk.init(
    dsn="${params.dsn.public}",
    traces_sample_rate=1.0,
    # Add data like inputs and responses to/from MCP servers;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
    integrations=[
        MCPIntegration(),
    ],
)`,
        },
        {
          type: 'text',
          text: t('Set up your low-level MCP server:'),
        },
        {
          type: 'code',
          language: 'python',
          code: `
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("mcp-server")

@mcp.tool()
async def calculate_sum(a: int, b: int) -> int:
    """Add two numbers together."""
    return a + b
`,
        },
      ],
    };

    const fastMcpStandaloneStep: OnboardingStep = {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: t('Configure Sentry for MCP low-level monitoring:'),
        },
        {
          type: 'code',
          language: 'python',
          code: `
import sentry_sdk
from sentry_sdk.integrations.mcp import MCPIntegration

sentry_sdk.init(
    dsn="${params.dsn.public}",
    traces_sample_rate=1.0,
    # Add data like inputs and responses to/from MCP servers;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
    integrations=[
        MCPIntegration(),
    ],
)`,
        },
        {
          type: 'text',
          text: t('Set up your low-level MCP server:'),
        },
        {
          type: 'code',
          language: 'python',
          code: `
from fastmcp import FastMCP

mcp = FastMCP("mcp-server")

@mcp.tool()
async def calculate_sum(a: int, b: int) -> int:
    """Add two numbers together."""
    return a + b
`,
        },
      ],
    };

    const manualStep: OnboardingStep = {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: t('Configure Sentry for manual MCP instrumentation:'),
        },
        {
          type: 'code',
          language: 'python',
          code: `
import sentry_sdk

sentry_sdk.init(
    dsn="${params.dsn.public}",
    traces_sample_rate=1.0,
)
`,
        },
        {
          type: 'text',
          text: t('TODO: Add description for manual MCP instrumentation setup.'),
        },
        {
          type: 'code',
          language: 'python',
          code: `
import json
import sentry_sdk

# Invoke Agent span
with sentry_sdk.start_span(op="gen_ai.invoke_agent", name="invoke_agent Weather Agent") as span:
    span.set_data("gen_ai.operation.name", "invoke_agent")
    span.set_data("gen_ai.system", "openai")
    span.set_data("gen_ai.request.model", "o3-mini")
    span.set_data("gen_ai.agent.name", "Weather Agent")
    span.set_data("gen_ai.response.text", json.dumps(["Hello World"]))
`,
        },
      ],
    };

    const selected = (params.platformOptions as any)?.integration ?? 'mcp_fastmcp';
    if (selected === 'mcp_fastmcp') {
      return [mcpFastMcpStep];
    }
    if (selected === 'fastmcp_standalone') {
      return [fastMcpStandaloneStep];
    }
    if (selected === 'manual') {
      return [manualStep];
    }
    return [mcpLowLevelStep];
  },
  verify: () => {
    const mcpVerifyStep: OnboardingStep = {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Verify that MCP monitoring is working correctly by triggering some MCP server interactions in your application.'
          ),
        },
      ],
    };

    return [mcpVerifyStep];
  },
  nextSteps: () => [],
};

export const agentMonitoringOnboarding: OnboardingConfig = {
  install: (params: Params) => {
    const selected = (params.platformOptions as any)?.integration ?? 'openai_agents';
    let packageName = 'sentry-sdk';

    if (selected === 'langchain') {
      packageName = 'sentry-sdk[langchain]';
    } else if (selected === 'langgraph') {
      packageName = 'sentry-sdk[langgraph]';
    } else if (selected === 'litellm') {
      packageName = 'sentry-sdk[litellm]';
    } else if (selected === 'google_genai') {
      packageName = 'sentry-sdk[google_genai]';
    }

    return [
      {
        type: StepType.INSTALL,
        content: [
          {
            type: 'text',
            text: t('Install our Python SDK:'),
          },
          getPythonInstallCodeBlock({packageName}),
        ],
      },
    ];
  },
  configure: (params: Params) => {
    const openaiAgentsStep: OnboardingStep = {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Import and initialize the Sentry SDK with the [openai:OpenAI Agents] integration:',
            {
              openai: (
                <ExternalLink href="https://docs.sentry.io/product/insights/agents/getting-started/#quick-start-with-openai-agents" />
              ),
            }
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `
import sentry_sdk
from sentry_sdk.integrations.openai_agents import OpenAIAgentsIntegration

sentry_sdk.init(
    dsn="${params.dsn.public}",
    traces_sample_rate=1.0,
    # Add data like inputs and responses to/from LLMs and tools;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
    integrations=[
        OpenAIAgentsIntegration(),
    ],
)`,
        },
        {
          type: 'text',
          text: t(
            'The OpenAI Agents integration will automatically collect information about agents, tools, prompts, tokens, and models.'
          ),
        },
      ],
    };

    const openaiSdkStep: OnboardingStep = {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Import and initialize the Sentry SDK - the OpenAIIntegration will be enabled automatically:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `
import sentry_sdk

sentry_sdk.init(
    dsn="${params.dsn.public}",
    traces_sample_rate=1.0,
    # Add data like inputs and responses to/from LLMs and tools;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
)`,
        },
      ],
    };

    const anthropicSdkStep: OnboardingStep = {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Import and initialize the Sentry SDK - the Anthropic Integration will be enabled automatically:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `
import sentry_sdk

sentry_sdk.init(
    dsn="${params.dsn.public}",
    traces_sample_rate=1.0,
    # Add data like inputs and responses to/from LLMs and tools;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
)`,
        },
      ],
    };

    const googleGenAIStep: OnboardingStep = {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Import and initialize the Sentry SDK - add the GoogleGenAIIntegration to your integrations list:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `
import sentry_sdk
from sentry_sdk.integrations.google_genai import GoogleGenAIIntegration

sentry_sdk.init(
    dsn="${params.dsn.public}",
    traces_sample_rate=1.0,
    # Add data like inputs and responses to/from LLMs and tools;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
    integrations=[
        GoogleGenAIIntegration(),
    ],
)`,
        },
      ],
    };

    const langchainStep: OnboardingStep = {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Import and initialize the Sentry SDK for [langchain:LangChain] monitoring:',
            {
              langchain: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/integrations/langchain/" />
              ),
            }
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `
import sentry_sdk
from sentry_sdk.integrations.openai import OpenAIIntegration

sentry_sdk.init(
    dsn="${params.dsn.public}",
    environment="local",
    traces_sample_rate=1.0,
    # Add data like inputs and responses to/from LLMs and tools;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
    # Disable OpenAI integration for correct token accounting
    disabled_integrations=[OpenAIIntegration()],
)`,
        },
        {
          type: 'text',
          text: t(
            'The LangChain integration will automatically collect information about agents, tools, prompts, tokens, and models.'
          ),
        },
      ],
    };

    const langgraphStep: OnboardingStep = {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Import and initialize the Sentry SDK for [langgraph:LangGraph] monitoring:',
            {
              langgraph: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/integrations/langgraph/" />
              ),
            }
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `
import sentry_sdk
from sentry_sdk.integrations.openai import OpenAIIntegration

sentry_sdk.init(
    dsn="${params.dsn.public}",
    environment="local",
    traces_sample_rate=1.0,
    # Add data like inputs and responses to/from LLMs and tools;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
    # Disable OpenAI integration for correct token accounting
    disabled_integrations=[OpenAIIntegration()],
)`,
        },
        {
          type: 'text',
          text: t(
            'The LangGraph integration will automatically collect information about agents, tools, prompts, tokens, and models.'
          ),
        },
      ],
    };

    const liteLLMStep: OnboardingStep = {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Import and initialize the Sentry SDK for [litellm:LiteLLM] monitoring:',
            {
              litellm: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/integrations/litellm/" />
              ),
            }
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `
import sentry_sdk
from sentry_sdk.integrations.openai import OpenAIIntegration
from sentry_sdk.integrations.litellm import LiteLLMIntegration

sentry_sdk.init(
    dsn="${params.dsn.public}",
    environment="local",
    traces_sample_rate=1.0,
    # Add data like inputs and responses to/from LLMs and tools;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
    integrations=[
        LiteLLMIntegration(),
    ],
    # Disable OpenAI integration for correct token accounting
    disabled_integrations=[OpenAIIntegration()],
)`,
        },
        {
          type: 'text',
          text: t(
            'The LiteLLM integration will automatically collect information about agents, tools, prompts, tokens, and models.'
          ),
        },
      ],
    };

    const manualStep: OnboardingStep = {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'If you are not using a supported SDK integration, you can instrument your AI calls manually. See [link:manual instrumentation docs] for details.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/tracing/instrumentation/custom-instrumentation/ai-agents-module/" />
              ),
            }
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `
import sentry_sdk

sentry_sdk.init(dsn="${params.dsn.public}", traces_sample_rate=1.0)
`,
        },
      ],
    };

    const selected = (params.platformOptions as any)?.integration ?? 'openai_agents';
    if (selected === 'openai') {
      return [openaiSdkStep];
    }
    if (selected === 'anthropic') {
      return [anthropicSdkStep];
    }
    if (selected === 'langchain') {
      return [langchainStep];
    }
    if (selected === 'langgraph') {
      return [langgraphStep];
    }
    if (selected === 'litellm') {
      return [liteLLMStep];
    }
    if (selected === 'google_genai') {
      return [googleGenAIStep];
    }
    if (selected === 'manual') {
      return [manualStep];
    }
    return [openaiAgentsStep];
  },
  verify: (params: Params) => {
    const openaiAgentsVerifyStep: OnboardingStep = {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Verify that agent monitoring is working correctly by creating and running a simple agent:'
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `
# Example Agents SDK usage (replace with your actual calls)
class MyAgent:
    def __init__(self, name: str, model_provider: str, model: str):
        self.name = name
        self.model_provider = model_provider
        self.model = model

    def run(self):
        # Your agent logic here
        return {"output": "Hello from agent"}

my_agent = MyAgent(
    name="Weather Agent",
    model_provider="openai",
    model="o3-mini",
)

result = my_agent.run()
print(result)
`,
        },
      ],
    };

    const openaiSdkVerifyStep: OnboardingStep = {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Verify that agent monitoring is working correctly by making a simple OpenAI API call:'
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `
from openai import OpenAI

client = OpenAI()
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Tell me a joke"}],
)
print(response.choices[0].message.content)
`,
        },
      ],
    };

    const anthropicSdkVerifyStep: OnboardingStep = {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Verify that agent monitoring is working correctly by making a simple Anthropic API call:'
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `
import anthropic

client = anthropic.Anthropic()
message = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1000,
    messages=[
        {"role": "user", "content": "Tell me a joke"}
    ]
)
print(message.content)
`,
        },
      ],
    };

    const langchainVerifyStep: OnboardingStep = {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Verify that agent monitoring is working correctly by creating a LangChain agent:'
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `
import random
from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.tools import tool

@tool
def roll_die(sides: int = 6) -> str:
    """Roll a die with a given number of sides"""
    return f"Rolled a {random.randint(1, sides)} on a {sides}-sided die."

with sentry_sdk.start_transaction(name="langchain-openai"):
    model = init_chat_model(
        "gpt-4o-mini",
        model_provider="openai",
        model_kwargs={"stream_options": {"include_usage": True}},
    )
    tools = [roll_die]
    prompt = ChatPromptTemplate.from_messages([
        SystemMessage(content="Greet the user and use the die roll tool."),
        HumanMessage(content="{input}"),
        MessagesPlaceholder("agent_scratchpad"),
    ])

    agent = create_openai_functions_agent(model, tools, prompt)
    agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

    result = agent_executor.invoke({
        "input": "Hello, my name is Alice! Please roll a six-sided die.",
        "chat_history": [],
    })
    print(result)
`,
        },
      ],
    };

    const langgraphVerifyStep: OnboardingStep = {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Verify that agent monitoring is working correctly by creating a LangGraph workflow:'
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `
import random
from typing import Annotated, Literal, TypedDict

from langchain.chat_models import init_chat_model
from langchain_core.messages import AnyMessage, HumanMessage
from langchain_core.tools import tool
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode


class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]

@tool
def roll_die(sides: int = 6) -> str:
    """Roll a die with a given number of sides"""
    return f"Rolled a {random.randint(1, sides)} on a {sides}-sided die."

def chatbot(state: State):
    model = init_chat_model("gpt-4o-mini", model_provider="openai")
    return {"messages": [model.bind_tools([roll_die]).invoke(state["messages"])]}

def should_continue(state: State) -> Literal["tools", END]:
    last_message = state["messages"][-1]
    return "tools" if getattr(last_message, "tool_calls", None) else END

with sentry_sdk.start_transaction(name="langgraph-openai"):
    graph_builder = StateGraph(State)
    graph_builder.add_node("chatbot", chatbot)
    graph_builder.add_node("tools", ToolNode([roll_die]))
    graph_builder.set_entry_point("chatbot")
    graph_builder.add_conditional_edges("chatbot", should_continue)
    graph_builder.add_edge("tools", "chatbot")
    graph = graph_builder.compile()
    result = graph.invoke({
        "messages": [
            HumanMessage(content="Hello, my name is Alice! Please roll a six-sided die.")
        ]
    })
    print(result)
`,
        },
      ],
    };

    const liteLLMVerifyStep: OnboardingStep = {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Verify that agent monitoring is working correctly by creating a LiteLLM completion:'
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `
from litellm import completion

response = completion(
    model="openai/gpt-4o-mini",
    messages=[{"role": "user", "content": "Tell me a joke"}],
)
print(response.choices[0].message.content)
`,
        },
      ],
    };

    const googleGenAIVerifyStep: OnboardingStep = {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Verify that agent monitoring is working correctly by making a simple Google Gen AI API call:'
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `
from google.genai import Client

client = Client()
response = client.models.generate_content(
    model="gemini-2.0-flash-exp",
    contents="What's the weather like in San Francisco?"
)

print(response)

`,
        },
      ],
    };

    const manualVerifyStep: OnboardingStep = {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Verify that agent monitoring is working correctly by running your manually instrumented code:'
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `
import json
import sentry_sdk

# Invoke Agent span
with sentry_sdk.start_span(op="gen_ai.invoke_agent", name="invoke_agent Weather Agent") as span:
    span.set_data("gen_ai.operation.name", "invoke_agent")
    span.set_data("gen_ai.system", "openai")
    span.set_data("gen_ai.request.model", "o3-mini")
    span.set_data("gen_ai.agent.name", "Weather Agent")
    span.set_data("gen_ai.response.text", json.dumps(["Hello World"]))

# AI Client span
with sentry_sdk.start_span(op="gen_ai.chat", name="chat o3-mini") as span:
    span.set_data("gen_ai.operation.name", "chat")
    span.set_data("gen_ai.system", "openai")
    span.set_data("gen_ai.request.model", "o3-mini")
    span.set_data("gen_ai.request.message", json.dumps([{"role": "user", "content": "Tell me a joke"}]))
    span.set_data("gen_ai.response.text", json.dumps(["joke..."]))
`,
        },
      ],
    };

    const selected = (params.platformOptions as any)?.integration ?? 'openai_agents';
    if (selected === 'openai') {
      return [openaiSdkVerifyStep];
    }
    if (selected === 'anthropic') {
      return [anthropicSdkVerifyStep];
    }
    if (selected === 'langchain') {
      return [langchainVerifyStep];
    }
    if (selected === 'langgraph') {
      return [langgraphVerifyStep];
    }
    if (selected === 'litellm') {
      return [liteLLMVerifyStep];
    }
    if (selected === 'google_genai') {
      return [googleGenAIVerifyStep];
    }
    if (selected === 'manual') {
      return [manualVerifyStep];
    }
    return [openaiAgentsVerifyStep];
  },
};

const logsOnboarding = getPythonLogsOnboarding();

const docs: Docs = {
  onboarding,
  performanceOnboarding,
  crashReportOnboarding: crashReportOnboardingPython,
  featureFlagOnboarding,
  profilingOnboarding: getPythonProfilingOnboarding({traceLifecycle: 'manual'}),
  agentMonitoringOnboarding,
  mcpOnboarding,
  logsOnboarding,
};

export default docs;

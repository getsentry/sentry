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
  getCrashReportBackendInstallStep,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {t, tct} from 'sentry/locale';
import {
  AlternativeConfiguration,
  getPythonInstallConfig,
  getPythonLogsOnboarding,
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
  verify: (params: Params) => [
    {
      type: StepType.VERIFY,
      configurations: [
        {
          description: t(
            'You can verify your setup by intentionally causing an error that breaks your application:'
          ),
          language: 'python',
          code: 'division_by_zero = 1 / 0',
        },
        ...(params.isLogsSelected
          ? [
              {
                description: t(
                  'You can send logs to Sentry using the Sentry logging APIs:'
                ),
                language: 'python',
                code: `import sentry_sdk

# Send logs directly to Sentry
sentry_sdk.logger.info('This is an info log message')
sentry_sdk.logger.warning('This is a warning message')
sentry_sdk.logger.error('This is an error message')`,
              },
              {
                description: t(
                  "You can also use Python's built-in logging module, which will automatically forward logs to Sentry:"
                ),
                language: 'python',
                code: `import logging

# Your existing logging setup
logger = logging.getLogger(__name__)

# These logs will be automatically sent to Sentry
logger.info('This will be sent to Sentry')
logger.warning('User login failed')
logger.error('Something went wrong')`,
              },
            ]
          : []),
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
  install: (params: Params) => {
    const selected = (params.platformOptions as any)?.integration ?? 'openai_agents';
    let packageName = 'sentry-sdk';

    if (selected === 'langchain') {
      packageName = 'sentry-sdk[langchain]';
    } else if (selected === 'langgraph') {
      packageName = 'sentry-sdk[langgraph]';
    }

    return [
      {
        type: StepType.INSTALL,
        description: t('Install our Python SDK:'),
        configurations: getPythonInstallConfig({packageName}),
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
  logsOnboarding,
};

export default docs;

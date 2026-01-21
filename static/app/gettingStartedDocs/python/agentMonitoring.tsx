import {ExternalLink} from 'sentry/components/core/link';
import type {
  OnboardingConfig,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {CopyLLMPromptButton} from 'sentry/views/insights/pages/agents/llmOnboardingInstructions';

import {getPythonInstallCodeBlock} from './utils';

export const agentMonitoring: OnboardingConfig = {
  install: params => {
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
    } else if (selected === 'pydantic_ai') {
      packageName = 'sentry-sdk[pydantic_ai]';
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
  configure: params => {
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
          text: t('Initialize the Sentry SDK in the entry point of your application.'),
        },
        {
          type: 'code',
          language: 'python',
          code: `import sentry_sdk

sentry_sdk.init(
    dsn="${params.dsn.public}",
    traces_sample_rate=1.0,
)`,
        },
        {
          type: 'text',
          text: tct(
            'Then follow the [link:manual instrumentation guide] to instrument your AI calls, or use an AI coding agent to do it for you.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/tracing/instrumentation/custom-instrumentation/ai-agents-module/" />
              ),
            }
          ),
        },
        {
          type: 'custom',
          content: <CopyLLMPromptButton />,
        },
      ],
    };

    const pydanticAiStep: OnboardingStep = {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Import and initialize the Sentry SDK for [pydantic_ai:Pydantic AI] monitoring:',
            {
              pydantic_ai: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/integrations/pydantic-ai/" />
              ),
            }
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `
import sentry_sdk
from sentry_sdk.integrations.pydantic_ai import PydanticAIIntegration
from sentry_sdk.integrations.openai import OpenAIIntegration


sentry_sdk.init(
    dsn="${params.dsn.public}",
    environment="local",
    traces_sample_rate=1.0,
    # Add data like inputs and responses to/from LLMs and tools;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
    integrations=[
        PydanticAIIntegration(),
    ],
)`,
        },
        {
          type: 'text',
          text: t(
            'The Pydantic AI integration will automatically collect information about agents, tools, prompts, tokens, and models.'
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
    if (selected === 'litellm') {
      return [liteLLMStep];
    }
    if (selected === 'google_genai') {
      return [googleGenAIStep];
    }
    if (selected === 'pydantic_ai') {
      return [pydanticAiStep];
    }
    if (selected === 'manual') {
      return [manualStep];
    }
    return [openaiAgentsStep];
  },
  verify: params => {
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

    const pydanticAiVerifyStep: OnboardingStep = {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Verify that agent monitoring is working correctly by creating a Pydantic AI agent:'
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `
from pydantic_ai import Agent

# Create an agent with OpenAI model
agent = Agent('openai:gpt-4o-mini')

# Run the agent
result = agent.run_sync('Tell me a joke')
print(result.data)
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
            'Verify that agent monitoring is working correctly by running your manually instrumented.'
          ),
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
    if (selected === 'pydantic_ai') {
      return [pydanticAiVerifyStep];
    }
    if (selected === 'manual') {
      return [manualVerifyStep];
    }
    return [openaiAgentsVerifyStep];
  },
  nextSteps: () => [],
};

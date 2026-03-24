import {ExternalLink} from '@sentry/scraps/link';

import type {
  OnboardingConfig,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {SdkUpdateAlert} from 'sentry/views/insights/pages/agents/components/sdkUpdateAlert';
import {ManualInstrumentationNote} from 'sentry/views/insights/pages/agents/llmOnboardingInstructions';

import {getPythonInstallCodeBlock} from './utils';

const MIN_REQUIRED_VERSION = '2.43.0';

export const agentMonitoring: OnboardingConfig = {
  introduction: params => (
    <SdkUpdateAlert
      projectId={params.project.id}
      minVersion={MIN_REQUIRED_VERSION}
      packageName="sentry-sdk"
    />
  ),
  install: () => {
    return [
      {
        type: StepType.INSTALL,
        content: [
          {
            type: 'text',
            text: t('Install our Python SDK:'),
          },
          getPythonInstallCodeBlock({minimumVersion: MIN_REQUIRED_VERSION}),
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
            'Import and initialize the Sentry SDK - the OpenAI Agents integration will be enabled automatically:',
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

    const openaiSdkStep: OnboardingStep = {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Import and initialize the Sentry SDK - the OpenAI integration will be enabled automatically:',
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
            'Import and initialize the Sentry SDK - the Anthropic integration will be enabled automatically:',
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
            'Import and initialize the Sentry SDK - the GoogleGenAI integration will be enabled automatically:',
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

    const langchainStep: OnboardingStep = {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Import and initialize the Sentry SDK - the LangChain integration will be enabled automatically:',
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

    const langgraphStep: OnboardingStep = {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Import and initialize the Sentry SDK - the LangGraph integration will be enabled automatically:',
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
    send_default_pii=True,
)`,
        },
        {
          type: 'custom',
          content: (
            <ManualInstrumentationNote
              docsLink={
                <ExternalLink href="https://docs.sentry.io/platforms/python/tracing/instrumentation/custom-instrumentation/ai-agents-module/" />
              }
            />
          ),
        },
      ],
    };

    const pydanticAiStep: OnboardingStep = {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Import and initialize the Sentry SDK - the PydanticAI integration will be enabled automatically:',
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
    environment="local",
    traces_sample_rate=1.0,
    # Add data like inputs and responses to/from LLMs and tools;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
)`,
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
from agents import Agent, Runner

# Setting the agent name is important for Sentry to identify and group agent activity
agent = Agent(
    name="Weather Agent",
    instructions="You are a helpful weather assistant.",
    model="gpt-5.4",
)

result = Runner.run_sync(agent, "What's the weather like in San Francisco?")
print(result.final_output)
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
    model="gpt-5.4",
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
    model="claude-sonnet-4-6",
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
from langchain.agents import create_agent
from langchain.chat_models import init_chat_model
from langchain_core.tools import tool

@tool
def roll_die(sides: int = 6) -> str:
    """Roll a die with a given number of sides"""
    return f"Rolled a {random.randint(1, sides)} on a {sides}-sided die."

model = init_chat_model("gpt-5.4", model_provider="openai")

# Setting the agent name helps Sentry identify and group agent activity
agent = create_agent(model, [roll_die], name="dice_agent")

result = agent.invoke({"messages": [("user", "Please roll a six-sided die.")]})
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
from langchain.agents import create_agent
from langchain.chat_models import init_chat_model
from langchain_core.tools import tool

@tool
def roll_die(sides: int = 6) -> str:
    """Roll a die with a given number of sides"""
    return f"Rolled a {random.randint(1, sides)} on a {sides}-sided die."

model = init_chat_model("gpt-5.4", model_provider="openai")

# Setting the agent name helps Sentry identify and group agent activity
agent = create_agent(model, [roll_die], name="dice_agent")

result = agent.invoke({"messages": [("user", "Please roll a six-sided die.")]})
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
    model="openai/gpt-5.4",
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
    model="gemini-3-flash-preview",
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

# Setting the agent name helps Sentry identify and group agent activity
agent = Agent('openai:gpt-5.4', name='joke_agent')

# Run the agent
result = agent.run_sync('Tell me a joke')
print(result.output)
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

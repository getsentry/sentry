import {Fragment} from 'react';

import {Button} from '@sentry/scraps/button';

import {useCopySetupInstructionsEnabled} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCopyMarkdownButton';
import {IconCopy} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';

export function ManualInstrumentationNote({docsLink}: {docsLink: React.ReactNode}) {
  const copyEnabled = useCopySetupInstructionsEnabled();

  if (copyEnabled) {
    return (
      <p>
        {tct(
          'Then follow the [link:manual instrumentation guide] to instrument your AI calls, or click [bold:Copy instructions] to have an AI coding agent do it for you.',
          {link: docsLink, bold: <strong />}
        )}
      </p>
    );
  }

  return (
    <Fragment>
      <p>
        {tct(
          'Then follow the [link:manual instrumentation guide] to instrument your AI calls, or use an AI coding agent to do it for you.',
          {link: docsLink}
        )}
      </p>
      <CopyLLMPromptButton />
    </Fragment>
  );
}

/**
 * @deprecated Will be removed when the `onboarding-copy-setup-instructions` feature flag GAs.
 */
export function CopyLLMPromptButton() {
  const {copy} = useCopyToClipboard();
  const organization = useOrganization();

  return (
    <Button
      size="sm"
      icon={<IconCopy />}
      onClick={() => {
        trackAnalytics('agent-monitoring.copy-llm-prompt-click', {
          organization,
        });
        copy(LLM_ONBOARDING_INSTRUCTIONS, {
          successMessage: t('Copied instrumentation prompt to clipboard'),
        });
      }}
    >
      {t('Copy Prompt for AI Agent')}
    </Button>
  );
}

/**
 * Contextual note prepended when the instructions follow onboarding setup
 * steps so the LLM knows to complete those first.
 */
export const LLM_ONBOARDING_INSTRUCTIONS_PREAMBLE = `> IMPORTANT: FOLLOW THE SETUP STEPS PROVIDED ABOVE THIS SECTION FIRST.
> They contain the correct DSN and project-specific SDK configuration. DO NOT SKIP THEM.
> Then use the guide below to add Sentry manual instrumentation for AI Agent Monitoring.
> Complete the verification step LAST.`;

export const LLM_ONBOARDING_INSTRUCTIONS = `# Instrument Sentry AI Agent Monitoring

Follow this decision tree to instrument AI Agent Monitoring.

## 1. Verify Sentry + Tracing

**Search for Sentry initialization:**
- JS/TS: \`Sentry.init\` in entry points, \`@sentry/*\` in package.json
- Python: \`sentry_sdk.init\` in entry points, \`sentry-sdk\` in requirements

**If not found:** Set up Sentry first following the official docs:
- JS/TS: https://docs.sentry.io/platforms/javascript/guides/node/
- Python: https://docs.sentry.io/platforms/python/

**Verify tracing is enabled** (REQUIRED for AI monitoring):
\`\`\`javascript
// JS - must have tracesSampleRate > 0, min SDK version 10.28.0
Sentry.init({ dsn: "...", tracesSampleRate: 1.0, sendDefaultPii: true })
\`\`\`
\`\`\`python
# Python - must have traces_sample_rate > 0
sentry_sdk.init(dsn="...", traces_sample_rate=1.0, send_default_pii=True)
\`\`\`

If missing, add \`tracesSampleRate: 1.0\` / \`traces_sample_rate=1.0\` and \`sendDefaultPii: true\` / \`send_default_pii=True\`.

## 2. Check for Supported AI Libraries

Check in this order - **use the highest-level framework found** (e.g., if using Vercel AI SDK with OpenAI provider, use Vercel integration, not OpenAI):

| Library (check in order) | Node.js | Browser | Python Integration | How to Name the Agent |
|--------------------------|---------|---------|-------------------|-----------------------|
| Vercel AI SDK | Auto-enabled (needs \`experimental_telemetry\`) | - | - | \`experimental_telemetry.functionId\` |
| LangGraph | Auto-enabled | \`instrumentLangGraph()\` | Auto-enabled | \`name\` param on \`create_agent\` (Python) / \`createReactAgent\` (JS) |
| LangChain | Auto-enabled | \`createLangChainCallbackHandler()\` | Auto-enabled | \`name\` param on \`create_agent\` |
| OpenAI Agents | - | - | Auto-enabled | \`name\` param on \`Agent()\` (required) |
| Pydantic AI | - | - | Auto-enabled | \`name\` param on \`Agent()\` |
| Mastra | Auto-enabled | - | - | \`name\` + \`id\` params on \`Agent()\` (required) |
| LiteLLM | - | - | \`LiteLLMIntegration()\` | Manual instrumentation (see 3B) |
| OpenAI | Auto-enabled | \`instrumentOpenAiClient()\` | Auto-enabled | Manual instrumentation (see 3B) |
| Anthropic | Auto-enabled | \`instrumentAnthropicAiClient()\` | Auto-enabled | Manual instrumentation (see 3B) |
| Google GenAI | Auto-enabled | \`instrumentGoogleGenAiClient()\` | Auto-enabled | Manual instrumentation (see 3B) |

**If supported library found → Step 3A** (Enable Automatic Integration: Node.js, Browser and Python)
**If no supported library → Step 3B** (Manual span instrumentation)

**IMPORTANT: Always set the agent name.** When the agent name is set, Sentry can identify and group agent activity, enabling agent-specific dashboards, trace grouping, and alerting.

## 3A. Enable Automatic Integration

### Node.js (Auto-enabled)

For Node.js applications (\`@sentry/node\`, \`@sentry/nestjs\`, etc.), AI integrations are **automatically enabled**. Just initialize Sentry with tracing:

\`\`\`javascript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "...",
  tracesSampleRate: 1.0,  // Required for AI monitoring
  sendDefaultPii: true,   // Add data like inputs and responses to/from LLMs and tools
});

// That's it! The SDK automatically instruments supported AI libraries
\`\`\`

**Vercel AI SDK Extra Step:** Pass \`experimental_telemetry\` to every call. Set \`functionId\` to name the agent:
\`\`\`javascript
const result = await generateText({
  model: openai("gpt-5.4"),
  prompt: "Tell me a joke",
  experimental_telemetry: {
    isEnabled: true,
    functionId: "my_agent",  // Names the agent in Sentry
    recordInputs: true,
    recordOutputs: true,
  },
});
\`\`\`

### Browser (Manual Client Wrapping)

For browser applications (\`@sentry/browser\`, \`@sentry/react\`, etc.), you must **manually wrap each AI client** using helper functions.

**Step 1:** Initialize Sentry with tracing:
\`\`\`javascript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "...",
  tracesSampleRate: 1.0,  // Required for AI monitoring
  sendDefaultPii: true,   // Add data like inputs and responses to/from LLMs and tools
});
\`\`\`

**Step 2:** Wrap your AI client instances with helper functions:

**OpenAI:**
\`\`\`javascript
import OpenAI from "openai";

const openai = new OpenAI();
const client = Sentry.instrumentOpenAiClient(openai, {
  recordInputs: true,
  recordOutputs: true,
});

// Use the wrapped client instead of the original
const response = await client.chat.completions.create({
  model: "gpt-5.4",
  messages: [{ role: "user", content: "Hello!" }],
});
\`\`\`

**Anthropic:**
\`\`\`javascript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();
const client = Sentry.instrumentAnthropicAiClient(anthropic, {
  recordInputs: true,
  recordOutputs: true,
});

const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello!" }],
});
\`\`\`

**Google Gen AI:**
\`\`\`javascript
import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey });
const client = Sentry.instrumentGoogleGenAiClient(genAI, {
  recordInputs: true,
  recordOutputs: true,
});

const response = await client.models.generateContent({
  model: "gemini-3-flash-preview",
  contents: "Why is the sky blue?",
});
console.log(response.text);
\`\`\`

**LangChain:**
\`\`\`javascript
import { ChatOpenAI } from "@langchain/openai";

// Create a callback handler
const callbackHandler = Sentry.createLangChainCallbackHandler({
  recordInputs: true,
  recordOutputs: true,
});

const llm = new ChatOpenAI();

// Use the callback handler when invoking
await llm.invoke("Tell me a joke", {
  callbacks: [callbackHandler],
});
\`\`\`

**LangGraph:**
\`\`\`javascript
import { createAgent } from "langchain";

// Set the name param to identify this agent in Sentry
const agent = createAgent({
  model: "openai:gpt-5.4",
  tools: [],
  name: "my_agent",
});

// Instrument the agent for browser-side tracing
Sentry.instrumentLangGraph(agent, {
  recordInputs: true,
  recordOutputs: true,
});
\`\`\`

**Important:** You must wrap EACH client instance separately. The helpers are not global integrations.

### Python (Most Libraries are auto-enabled, except LiteLLM)

#### Auto-enabled Libraries (see table above):

For most Python AI libraries, integrations are **automatically enabled**. Just initialize Sentry:

\`\`\`python
import sentry_sdk

sentry_sdk.init(
    dsn="...",
    # Required for AI monitoring
    traces_sample_rate=1.0,
    # Add data like request headers and IP for users, if applicable;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
)
\`\`\`

#### How to Name Agents per Framework (Python)

**OpenAI Agents SDK** — \`name\` is required:
\`\`\`python
from agents import Agent, Runner

agent = Agent(
    name="my_agent",  # Required — names the agent in Sentry
    instructions="You are a helpful assistant.",
    model="gpt-5.4",
)
result = Runner.run_sync(agent, "Hello!")
\`\`\`

**Pydantic AI** — pass \`name\` to \`Agent()\`:
\`\`\`python
from pydantic_ai import Agent

agent = Agent("openai:gpt-5.4", name="my_agent")
result = agent.run_sync("Hello!")
\`\`\`

**LangGraph / LangChain** — pass \`name\` to \`create_agent()\`:
\`\`\`python
from langchain.agents import create_agent

agent = create_agent(model, tools, name="my_agent")
result = agent.invoke({"messages": [("user", "Hello!")]})
\`\`\`

**Mastra** (Node.js) — \`id\` and \`name\` are required:
\`\`\`javascript
const agent = new Agent({
  id: "my-agent",     // Unique identifier
  name: "My Agent",   // Display name in Sentry
  instructions: "You are a helpful assistant.",
  model: "openai/gpt-5.4",
});
\`\`\`

#### LiteLLM:

\`\`\`python
import sentry_sdk
from sentry_sdk.integrations.litellm import LiteLLMIntegration
sentry_sdk.init(
    dsn="...",
    # Required for AI monitoring
    traces_sample_rate=1.0,
    # Add data like inputs and responses;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
    integrations=[
        LiteLLMIntegration(),
    ],
)
\`\`\`

## 3B. Manual Instrumentation

Create spans with these exact \`op\` values and attributes:

### AI Request (LLM call)
- **op:** \`"gen_ai.request"\`
- **name:** \`"chat <model>"\`
- **Required:** \`gen_ai.request.model\`
- **Recommended:** \`gen_ai.usage.input_tokens\`, \`gen_ai.usage.output_tokens\`

\`\`\`python
with sentry_sdk.start_span(op="gen_ai.request", name=f"chat {model}") as span:
    span.set_data("gen_ai.request.model", model)
    result = llm.generate(messages)
    span.set_data("gen_ai.usage.input_tokens", result.input_tokens)
    span.set_data("gen_ai.usage.output_tokens", result.output_tokens)
    span.set_data("gen_ai.usage.input_tokens.cached", result.cached_tokens)
\`\`\`

### Invoke Agent
- **op:** \`"gen_ai.invoke_agent"\`
- **name:** \`"invoke_agent <AgentName>"\`
- **Required:** \`gen_ai.request.model\`, \`gen_ai.agent.name\`

\`\`\`python
with sentry_sdk.start_span(op="gen_ai.invoke_agent", name=f"invoke_agent {agent_name}") as span:
    span.set_data("gen_ai.agent.name", agent_name)
    span.set_data("gen_ai.request.model", model)
    result = agent.run()
\`\`\`

### Execute Tool
- **op:** \`"gen_ai.execute_tool"\`
- **name:** \`"execute_tool <tool_name>"\`
- **Required:** \`gen_ai.tool.name\`

\`\`\`python
with sentry_sdk.start_span(op="gen_ai.execute_tool", name=f"execute_tool {tool_name}") as span:
    span.set_data("gen_ai.tool.name", tool_name)
    span.set_data("gen_ai.tool.input", json.dumps(inputs))
    result = tool(**inputs)
    span.set_data("gen_ai.tool.output", json.dumps(result))
\`\`\`

### Handoff (agent-to-agent)
- **op:** \`"gen_ai.handoff"\`
- **name:** \`"handoff from <A> to <B>"\`

\`\`\`python
with sentry_sdk.start_span(op="gen_ai.handoff", name=f"handoff from {a} to {b}"):
    pass
\`\`\`

## Key Rules

1. **Always set the agent name** — this enables Sentry to group traces by agent, show agent-specific dashboards, and set up alerts per agent
2. **All complex data must be JSON-stringified** - span attributes only accept primitives
3. **\`gen_ai.request.model\` is required** on \`gen_ai.request\` and \`gen_ai.invoke_agent\` spans
4. **Nest spans correctly:** \`gen_ai.invoke_agent\` spans should contain \`gen_ai.request\` and \`gen_ai.execute_tool\` spans as children
5. **JS min version:** \`@sentry/node@10.28.0\` or later. If the project does not have the Sentry SDK installed yet, prefer installing the latest version
6. **Enable PII:** \`sendDefaultPii: true\` (JS) / \`send_default_pii=True\` (Python) to capture inputs/outputs
`;

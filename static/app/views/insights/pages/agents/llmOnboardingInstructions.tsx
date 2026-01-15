import {Button} from 'sentry/components/core/button';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import useOrganization from 'sentry/utils/useOrganization';

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

const LLM_ONBOARDING_INSTRUCTIONS = `
# Instrument Sentry AI Agent Monitoring

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

| Library (check in order) | Node.js | Browser | Python Integration | Python Extra |
|--------------------------|---------|---------|-------------------|--------------|
| Vercel AI SDK | Auto-enabled (needs \`experimental_telemetry\`) | - | - | - |
| LangGraph | Auto-enabled | \`instrumentLangChainClient()\` | Auto-enabled | \`sentry-sdk[langgraph]\` |
| LangChain | Auto-enabled | \`instrumentLangChainClient()\` | Auto-enabled | \`sentry-sdk[langchain]\` |
| OpenAI Agents | - | - | Auto-enabled | - |
| Pydantic AI | - | - | Auto-enabled | \`sentry-sdk[pydantic_ai]\` |
| LiteLLM | - | - | \`LiteLLMIntegration()\` | \`sentry-sdk[litellm]\` |
| OpenAI | Auto-enabled | \`instrumentOpenAiClient()\` | Auto-enabled | - |
| Anthropic | Auto-enabled | \`instrumentAnthropicAiClient()\` | Auto-enabled | - |
| Google GenAI | Auto-enabled | \`instrumentGoogleGenAiClient()\` | \`GoogleGenAIIntegration()\` | \`sentry-sdk[google_genai]\` |

**If supported library found → Step 3A** (Node.js: auto-enabled, Browser: wrap clients)
**If no supported library → Step 3B** (Manual span instrumentation)

## 3A. Enable Automatic Integration

### 3A-1: Node.js (Auto-enabled)

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

**Vercel AI SDK Extra Step:** Pass \`experimental_telemetry\` to every call:
\`\`\`javascript
const result = await generateText({
  model: openai("gpt-4o"),
  prompt: "Tell me a joke",
  experimental_telemetry: {
    isEnabled: true,
    recordInputs: true,
    recordOutputs: true,
  },
});
\`\`\`

### 3A-2: Browser (Manual Client Wrapping)

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
  model: "gpt-4o",
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
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello!" }],
});
\`\`\`

**Google Gen AI:**
\`\`\`javascript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(apiKey);
const client = Sentry.instrumentGoogleGenAiClient(genAI, {
  recordInputs: true,
  recordOutputs: true,
});

const model = client.getGenerativeModel({ model: "gemini-pro" });
\`\`\`

**LangChain/LangGraph:**
\`\`\`javascript
import { ChatOpenAI } from "@langchain/openai";

const llm = new ChatOpenAI();
const client = Sentry.instrumentLangChainClient(llm, {
  recordInputs: true,
  recordOutputs: true,
});
\`\`\`

**Important:** You must wrap EACH client instance separately. The helpers are not global integrations.

### Python

Install with extras if needed:
\`\`\`bash
pip install sentry-sdk[langchain]  # or [langgraph], [litellm], [google_genai], [pydantic_ai]
\`\`\`

Configure (some integrations auto-enable, some need explicit import):

\`\`\`python
import sentry_sdk
# Only import if NOT auto-enabled (see table above)
from sentry_sdk.integrations.openai_agents import OpenAIAgentsIntegration

sentry_sdk.init(
    dsn="...",
    traces_sample_rate=1.0,
    send_default_pii=True,  # Required to capture inputs/outputs
    integrations=[
        OpenAIAgentsIntegration(),  # Only if explicit integration needed
    ],
)
\`\`\`

**Done.** SDK auto-instruments AI calls.

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

1. **All complex data must be JSON-stringified** - span attributes only accept primitives
2. **\`gen_ai.request.model\` is required** on \`gen_ai.request\` and \`gen_ai.invoke_agent\` spans
3. **Nest spans correctly:** \`gen_ai.invoke_agent\` spans should contain \`gen_ai.request\` and \`gen_ai.execute_tool\` spans as children
4. **JS min version:** \`@sentry/node@10.28.0\` or later
5. **Enable PII:** \`sendDefaultPii: true\` (JS) / \`send_default_pii=True\` (Python) to capture inputs/outputs
`;

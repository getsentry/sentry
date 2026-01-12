import {Button} from 'sentry/components/core/button';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';

export function CopyLLMPromptButton() {
  const {copy} = useCopyToClipboard();

  return (
    <Button
      size="sm"
      icon={<IconCopy />}
      onClick={() =>
        copy(LLM_ONBOARDING_INSTRUCTIONS, {
          successMessage: t('Copied instrumentation prompt to clipboard'),
        })
      }
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

| Library (check in order) | JS Integration | Python Integration | Python Extra |
|--------------------------|---------------|-------------------|--------------|
| Vercel AI SDK | \`Sentry.vercelAIIntegration()\` | - | - |
| LangGraph | \`Sentry.langGraphIntegration()\` | Auto-enabled | \`sentry-sdk[langgraph]\` |
| LangChain | \`Sentry.langChainIntegration()\` | Auto-enabled | \`sentry-sdk[langchain]\` |
| OpenAI Agents | - | \`OpenAIAgentsIntegration()\` | - |
| Pydantic AI | - | \`PydanticAIIntegration()\` | \`sentry-sdk[pydantic_ai]\` |
| LiteLLM | - | \`LiteLLMIntegration()\` | \`sentry-sdk[litellm]\` |
| OpenAI | \`Sentry.openAIIntegration()\` | Auto-enabled | - |
| Anthropic | \`Sentry.anthropicAIIntegration()\` | Auto-enabled | - |
| Google GenAI | \`Sentry.googleGenAIIntegration()\` | \`GoogleGenAIIntegration()\` | \`sentry-sdk[google_genai]\` |

**If supported library found → Step 3A**
**If no supported library → Step 3B**

## 3A. Enable Automatic Integration

### JavaScript

Add to Sentry.init integrations array with \`recordInputs\` and \`recordOutputs\`:

\`\`\`javascript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "...",
  tracesSampleRate: 1.0,
  sendDefaultPii: true,
  integrations: [
    Sentry.openAIIntegration({ recordInputs: true, recordOutputs: true }),
    // OR other integration as needed
  ],
});
\`\`\`

**Vercel AI SDK Extra Step:** Pass \`experimental_telemetry\` with \`functionId\` to every call:
\`\`\`javascript
const result = await generateText({
  model: openai("gpt-4o"),
  prompt: "Tell me a joke",
  experimental_telemetry: {
    isEnabled: true,
    functionId: "generate-joke",  // Name your functions for better tracing
    recordInputs: true,
    recordOutputs: true,
  },
});
\`\`\`

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
2. **\`gen_ai.request.model\` is required** on all AI request and agent spans
3. **Nest spans correctly:** Agent span → contains Request spans and Tool spans (siblings)
4. **JS min version:** \`@sentry/node@10.28.0\` or later
5. **Enable PII:** \`sendDefaultPii: true\` (JS) / \`send_default_pii=True\` (Python) to capture inputs/outputs
`;

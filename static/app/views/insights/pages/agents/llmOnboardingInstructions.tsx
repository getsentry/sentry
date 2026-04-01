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
export const LLM_ONBOARDING_INSTRUCTIONS_PREAMBLE = `> The setup steps above contain the correct DSN and project-specific SDK configuration — complete them first.
> Then use the guide below for additional instrumentation and agent naming.`;

export const LLM_ONBOARDING_INSTRUCTIONS = `# Instrument Sentry AI Agent Monitoring

Use this guide alongside the setup steps above.

## 1. Verify Sentry + Tracing

**Search for Sentry initialization:**
- JS/TS: \`Sentry.init\` in entry points, \`@sentry/*\` in package.json
- Python: \`sentry_sdk.init\` in entry points, \`sentry-sdk\` in requirements

**If not found:** Set up Sentry first following the official docs:
- JS/TS: https://docs.sentry.io/platforms/javascript/guides/node/
- Python: https://docs.sentry.io/platforms/python/

**Verify tracing is enabled** (REQUIRED for AI monitoring):
- JS: \`tracesSampleRate: 1.0\` and \`sendDefaultPii: true\` in \`Sentry.init\`. Min SDK version \`10.28.0\`.
- Python: \`traces_sample_rate=1.0\` and \`send_default_pii=True\` in \`sentry_sdk.init()\`.

## 2. Check for Supported AI Libraries

Check in this order — **use the highest-level framework found** (e.g., if using Vercel AI SDK with OpenAI provider, use Vercel integration, not OpenAI):

| Library | Node.js | Browser | Python | How to Name the Agent |
|---------|---------|---------|--------|-----------------------|
| Vercel AI SDK | Auto (needs \`experimental_telemetry\`) | - | - | \`experimental_telemetry.functionId\` |
| LangGraph | Auto | \`instrumentLangGraph()\` | Auto | \`name\` param on \`create_agent\` |
| LangChain | Auto | \`createLangChainCallbackHandler()\` | Auto | \`name\` param on \`create_agent\` |
| OpenAI Agents | - | - | Auto | \`name\` param on \`Agent()\` (required) |
| Pydantic AI | - | - | Auto | \`name\` param on \`Agent()\` |
| Mastra | Auto | - | - | \`name\` + \`id\` params on \`Agent()\` (required) |
| LiteLLM | - | - | \`LiteLLMIntegration()\` | Manual instrumentation (see 3B) |
| OpenAI | Auto | \`instrumentOpenAiClient()\` | Auto | Manual instrumentation (see 3B) |
| Anthropic | Auto | \`instrumentAnthropicAiClient()\` | Auto | Manual instrumentation (see 3B) |
| Google GenAI | Auto | \`instrumentGoogleGenAiClient()\` | Auto | Manual instrumentation (see 3B) |

**If supported library found → Step 3A**
**If no supported library → Step 3B** (Manual span instrumentation)

**IMPORTANT: Always set the agent name.** It enables agent-specific dashboards, trace grouping, and alerting.

## 3A. Enable Automatic Integration

### Node.js (Auto-enabled)

For Node.js (\`@sentry/node\`, \`@sentry/nestjs\`, etc.), AI integrations are **automatically enabled** — just ensure Sentry is initialized with tracing.

**Vercel AI SDK Extra Step:** Pass \`experimental_telemetry\` to every call:
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

For browser apps (\`@sentry/browser\`, \`@sentry/react\`), **manually wrap each AI client**:

**OpenAI:**
\`\`\`javascript
const client = Sentry.instrumentOpenAiClient(new OpenAI(), {
  recordInputs: true,
  recordOutputs: true,
});
\`\`\`

**Anthropic:**
\`\`\`javascript
const client = Sentry.instrumentAnthropicAiClient(new Anthropic(), {
  recordInputs: true,
  recordOutputs: true,
});
\`\`\`

**Google Gen AI:**
\`\`\`javascript
const client = Sentry.instrumentGoogleGenAiClient(new GoogleGenAI({ apiKey }), {
  recordInputs: true,
  recordOutputs: true,
});
\`\`\`

**LangChain:**
\`\`\`javascript
const callbackHandler = Sentry.createLangChainCallbackHandler({
  recordInputs: true,
  recordOutputs: true,
});
await llm.invoke("Tell me a joke", { callbacks: [callbackHandler] });
\`\`\`

**LangGraph:**
\`\`\`javascript
Sentry.instrumentLangGraph(agent, {
  recordInputs: true,
  recordOutputs: true,
});
\`\`\`

**Important:** You must wrap EACH client instance separately. The helpers are not global integrations.

### Python

Most Python AI libraries are **auto-enabled** — just ensure Sentry is initialized with tracing.

**LiteLLM** requires explicit integration:
\`\`\`python
from sentry_sdk.integrations.litellm import LiteLLMIntegration
sentry_sdk.init(
    dsn="...",
    traces_sample_rate=1.0,
    send_default_pii=True,
    integrations=[LiteLLMIntegration()],
)
\`\`\`

### How to Name Agents per Framework

**OpenAI Agents SDK** — \`name\` is required:
\`\`\`python
agent = Agent(name="my_agent", instructions="You are a helpful assistant.", model="gpt-5.4")
\`\`\`

**Pydantic AI:**
\`\`\`python
agent = Agent("openai:gpt-5.4", name="my_agent")
\`\`\`

**LangGraph / LangChain:**
\`\`\`python
agent = create_agent(model, tools, name="my_agent")
\`\`\`

**Mastra** (Node.js) — \`id\` and \`name\` are required:
\`\`\`javascript
const agent = new Agent({
  id: "my-agent",
  name: "My Agent",
  instructions: "You are a helpful assistant.",
  model: "openai/gpt-5.4",
});
\`\`\`

## 3B. Manual Instrumentation

Create spans with these exact \`op\` values and attributes:

### AI Request (LLM call)
- **op:** \`"gen_ai.request"\`, **name:** \`"chat <model>"\`
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
- **op:** \`"gen_ai.invoke_agent"\`, **name:** \`"invoke_agent <AgentName>"\`
- **Required:** \`gen_ai.request.model\`, \`gen_ai.agent.name\`

\`\`\`python
with sentry_sdk.start_span(op="gen_ai.invoke_agent", name=f"invoke_agent {agent_name}") as span:
    span.set_data("gen_ai.agent.name", agent_name)
    span.set_data("gen_ai.request.model", model)
    result = agent.run()
\`\`\`

### Execute Tool
- **op:** \`"gen_ai.execute_tool"\`, **name:** \`"execute_tool <tool_name>"\`
- **Required:** \`gen_ai.tool.name\`

\`\`\`python
with sentry_sdk.start_span(op="gen_ai.execute_tool", name=f"execute_tool {tool_name}") as span:
    span.set_data("gen_ai.tool.name", tool_name)
    span.set_data("gen_ai.tool.input", json.dumps(inputs))
    result = tool(**inputs)
    span.set_data("gen_ai.tool.output", json.dumps(result))
\`\`\`

## Token Counting & Cost Calculation

\`gen_ai.usage.input_tokens\` must be the **total** input tokens (cached + non-cached). Sentry computes cost as \`(input_tokens - cached_tokens) * price\`, so if \`input_tokens\` only contains non-cached tokens, costs go **negative**. Each \`gen_ai.request\` span should only report its own token usage, not an accumulation of tokens from previous spans in the conversation.

\`\`\`python
# Correct — input_tokens includes cached
span.set_data("gen_ai.usage.input_tokens", 100)          # total
span.set_data("gen_ai.usage.input_tokens.cached", 80)    # cached subset
span.set_data("gen_ai.usage.output_tokens", 50)

# Wrong — produces negative cost
span.set_data("gen_ai.usage.input_tokens", 20)            # non-cached only
span.set_data("gen_ai.usage.input_tokens.cached", 80)     # (20 - 80) * price → negative
\`\`\`

See: https://docs.sentry.io/ai/monitoring/agents/costs/#troubleshooting

## Key Rules

1. **Always set the agent name** — enables per-agent dashboards, trace grouping, and alerting
2. **All complex data must be JSON-stringified** — span attributes only accept primitives
3. **\`gen_ai.request.model\` is required** on \`gen_ai.request\` and \`gen_ai.invoke_agent\` spans
4. **Nest spans correctly:** \`gen_ai.invoke_agent\` should contain \`gen_ai.request\` and \`gen_ai.execute_tool\` as children
5. **JS min version:** \`@sentry/node@10.28.0\` or later
6. **Enable PII:** \`sendDefaultPii: true\` (JS) / \`send_default_pii=True\` (Python) to capture inputs/outputs
7. **\`gen_ai.usage.input_tokens\` must include cached tokens** — otherwise cost calculations will be negative
`;

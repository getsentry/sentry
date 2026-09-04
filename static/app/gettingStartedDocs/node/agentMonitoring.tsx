import {ExternalLink} from '@sentry/scraps/link';

import {
  StepType,
  type ContentBlock,
  type DocsParams,
  type OnboardingConfig,
  type OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getImport, getInstallCodeBlock} from 'sentry/gettingStartedDocs/node/utils';
import {t, tct} from 'sentry/locale';
import {SdkUpdateAlert} from 'sentry/views/insights/pages/agents/components/sdkUpdateAlert';
import {ManualInstrumentationNote} from 'sentry/views/insights/pages/agents/llmOnboardingInstructions';
import {
  AGENT_INTEGRATION_LABELS,
  AgentIntegration,
  DeploymentTarget,
} from 'sentry/views/insights/pages/agents/utils/agentIntegrations';

// Bumped to 10.67.0 so the install step also satisfies Workers AI, which
// auto-instruments the `env.AI` binding only from that version.
export const MIN_REQUIRED_VERSION = '10.67.0';

// The Cloudflare Agents SDK helper `instrumentAgentWithSentry` only exists from
// this version; earlier SDKs expose `instrumentDurableObjectWithSentry` instead.
// @see https://docs.sentry.io/platforms/javascript/guides/cloudflare/features/agents-sdk/
const CLOUDFLARE_AGENTS_MIN_VERSION = '10.69.0';

const CLOUDFLARE_AGENT_TRACING_DOCS =
  'https://docs.sentry.io/platforms/javascript/guides/cloudflare/agent-tracing/';
const CLOUDFLARE_DURABLE_OBJECTS_DOCS =
  'https://docs.sentry.io/platforms/javascript/guides/cloudflare/features/durableobject/';
const CLOUDFLARE_AGENTS_SDK_DOCS =
  'https://docs.sentry.io/platforms/javascript/guides/cloudflare/features/agents-sdk/';
const FLUE_NODE_AGENT_TRACING_DOCS =
  'https://docs.sentry.io/platforms/javascript/guides/node/agent-tracing/flue/';
const FLUE_CLOUDFLARE_AGENT_TRACING_DOCS =
  'https://docs.sentry.io/platforms/javascript/guides/cloudflare/agent-tracing/flue/';
const EVE_AGENT_TRACING_DOCS =
  'https://docs.sentry.io/platforms/javascript/guides/node/agent-tracing/eve/';

export function getAgentIntegration(params: DocsParams): AgentIntegration {
  return (params.platformOptions?.integration ??
    AgentIntegration.VERCEL_AI) as AgentIntegration;
}

export function getDeploymentTarget(params: DocsParams): DeploymentTarget {
  return (params.platformOptions?.deploymentTarget ??
    DeploymentTarget.NODE) as DeploymentTarget;
}

/**
 * The minimum SDK version required for the selected integration. Most SDKs share
 * MIN_REQUIRED_VERSION, but the Cloudflare Agents SDK needs a newer release.
 */
export function getMinRequiredVersion(params: DocsParams, fallback: string): string {
  return getAgentIntegration(params) === AgentIntegration.CLOUDFLARE_AGENTS
    ? CLOUDFLARE_AGENTS_MIN_VERSION
    : fallback;
}

/**
 * Cloudflare Workers don't expose the public `Sentry.init()` API. Instead the
 * SDK is bootstrapped by wrapping the worker with `Sentry.withSentry`. The
 * Vercel AI SDK additionally requires the `nodejs_compat` entrypoint and its
 * integration to be registered explicitly.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/cloudflare/agent-tracing/
 */
function getCloudflareConfigureSnippet({
  dsn,
  integration,
}: {
  dsn: string;
  integration?: AgentIntegration;
}): string {
  const isVercelAi = integration === AgentIntegration.VERCEL_AI;
  const importPath = isVercelAi
    ? '@sentry/cloudflare/nodejs_compat'
    : '@sentry/cloudflare';
  const integrationsLine = isVercelAi
    ? '\n    integrations: [Sentry.vercelAIIntegration()],'
    : '';

  return `import * as Sentry from "${importPath}";

export default Sentry.withSentry(
  (env) => ({
    dsn: "${dsn}",
    // Tracing must be enabled for agent monitoring to work
    tracesSampleRate: 1.0,
    dataCollection: {
      // Control data collection of LLMs and tools.
      // For more info visit: https://docs.sentry.io/platforms/javascript/data-management/data-collected/
      // genAI: { inputs: false, outputs: false },
    },${integrationsLine}
  }),
  {
    async fetch(request, env, ctx) {
      // Your worker logic goes here
      return new Response("Hello World!");
    },
  }
);`;
}

const WORKERS_AI_DOCS =
  'https://docs.sentry.io/platforms/javascript/guides/cloudflare/features/workers-ai/';

/**
 * `instrumentDurableObjectWithSentry` is the Durable-Object / Agents-SDK
 * equivalent of `withSentry` - a bootstrapping concern that is independent of
 * the chosen AI SDK, so this note is shown for every Cloudflare integration.
 */
function getDurableObjectsNote(): ContentBlock {
  return {
    type: 'text',
    text: tct(
      'If your AI calls run inside a [durableObjectsLink:Durable Object] or [agentsSdkLink:Agents SDK] agent rather than the fetch handler, bootstrap Sentry there too with [code:instrumentDurableObjectWithSentry] - it takes the same options as [code:withSentry].',
      {
        code: <code />,
        durableObjectsLink: <ExternalLink href={CLOUDFLARE_DURABLE_OBJECTS_DOCS} />,
        agentsSdkLink: <ExternalLink href={CLOUDFLARE_AGENTS_SDK_DOCS} />,
      }
    ),
  };
}

/**
 * Workers AI (`env.AI`) is Cloudflare-native and auto-instruments once the
 * Worker is wrapped with `withSentry` - no client wrapping required.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/cloudflare/features/workers-ai/
 */
function getWorkersAiNote(): ContentBlock {
  return {
    type: 'text',
    text: tct(
      "Sentry automatically instruments the [link:Workers AI binding] ([code:env.AI]) once your Worker is wrapped - there's no extra setup.",
      {
        code: <code />,
        link: <ExternalLink href={WORKERS_AI_DOCS} />,
      }
    ),
  };
}

/**
 * Unlike Node's OpenTelemetry-based auto-instrumentation, these SDKs are NOT
 * auto-instrumented on Cloudflare Workers - the client has to be wrapped
 * explicitly for AI spans to be captured. Vercel AI (enabled via
 * `vercelAIIntegration()`) and Workers AI (native `env.AI` binding) are
 * excluded because they don't require client wrapping.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/cloudflare/agent-tracing/#instrumentation
 */
const CLOUDFLARE_WRAP_INTEGRATIONS: readonly AgentIntegration[] = [
  AgentIntegration.OPENAI,
  AgentIntegration.ANTHROPIC,
  AgentIntegration.GOOGLE_GENAI,
  AgentIntegration.LANGCHAIN,
  AgentIntegration.LANGGRAPH,
];

const CLOUDFLARE_WRAP_HELPERS: Partial<Record<AgentIntegration, string>> = {
  [AgentIntegration.OPENAI]: 'instrumentOpenAiClient',
  [AgentIntegration.ANTHROPIC]: 'instrumentAnthropicAiClient',
  [AgentIntegration.GOOGLE_GENAI]: 'instrumentGoogleGenAIClient',
  [AgentIntegration.LANGCHAIN]: 'createLangChainCallbackHandler',
  [AgentIntegration.LANGGRAPH]: 'instrumentLangGraph',
};

const CLOUDFLARE_WRAP_SNIPPETS: Partial<Record<AgentIntegration, string>> = {
  [AgentIntegration.OPENAI]: `import * as Sentry from "@sentry/cloudflare";
import OpenAI from "openai";

// Wrap the client so its calls are captured as AI spans
const client = Sentry.instrumentOpenAiClient(new OpenAI());

const response = await client.responses.create({
  model: "gpt-5.4",
  input: "Tell me a joke",
});`,
  [AgentIntegration.ANTHROPIC]: `import * as Sentry from "@sentry/cloudflare";
import Anthropic from "@anthropic-ai/sdk";

// Wrap the client so its calls are captured as AI spans
const client = Sentry.instrumentAnthropicAiClient(new Anthropic());

const msg = await client.messages.create({
  model: "claude-sonnet-4-6",
  messages: [{ role: "user", content: "Tell me a joke" }],
});`,
  [AgentIntegration.GOOGLE_GENAI]: `import * as Sentry from "@sentry/cloudflare";
import { GoogleGenAI } from "@google/genai";

// Wrap the client so its calls are captured as AI spans
const client = Sentry.instrumentGoogleGenAIClient(new GoogleGenAI());

const response = await client.models.generateContent({
  model: "gemini-3-flash-preview",
  contents: "Why is the sky blue?",
});`,
  [AgentIntegration.LANGCHAIN]: `import * as Sentry from "@sentry/cloudflare";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// Pass the callback handler so LangChain calls are captured as AI spans
const callbackHandler = Sentry.createLangChainCallbackHandler();

const chatModel = new ChatOpenAI({ modelName: "gpt-5.4" });

const response = await chatModel.invoke(
  [
    new SystemMessage("You are a helpful assistant."),
    new HumanMessage("Tell me a joke"),
  ],
  { callbacks: [callbackHandler] }
);`,
  [AgentIntegration.LANGGRAPH]: `import * as Sentry from "@sentry/cloudflare";
import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const llm = new ChatOpenAI({ modelName: "gpt-5.4" });

async function callLLM(state) {
  const response = await llm.invoke(state.messages);
  return { messages: [...state.messages, response] };
}

const agent = new StateGraph(MessagesAnnotation)
  .addNode("agent", callLLM)
  .addEdge(START, "agent")
  .addEdge("agent", END);

// Instrument the graph BEFORE compiling so its calls are captured as AI spans
Sentry.instrumentLangGraph(agent);

const graph = agent.compile({ name: "joke_agent" });

const result = await graph.invoke({
  messages: [
    new SystemMessage("You are a helpful assistant."),
    new HumanMessage("Tell me a joke"),
  ],
});`,
};

function getCloudflareWrapBlocks(integration: AgentIntegration): ContentBlock[] {
  const helper = CLOUDFLARE_WRAP_HELPERS[integration];
  const code = CLOUDFLARE_WRAP_SNIPPETS[integration];

  if (!helper || !code) {
    return [];
  }

  return [
    {
      type: 'text',
      text: tct(
        "On Cloudflare, [label] isn't auto-instrumented. Wrap your client with [helper] so its calls are captured as AI spans:",
        {
          label: AGENT_INTEGRATION_LABELS[integration] ?? integration,
          helper: <code>{helper}</code>,
        }
      ),
    },
    {
      type: 'code',
      tabs: [{label: 'JavaScript', language: 'javascript', code}],
    },
  ];
}

export const mastraOnboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Install the [code:@mastra/sentry] package to enable Sentry integration with Mastra.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'npm',
              language: 'bash',
              code: 'npm install @mastra/sentry',
            },
            {
              label: 'yarn',
              language: 'bash',
              code: 'yarn add @mastra/sentry',
            },
            {
              label: 'pnpm',
              language: 'bash',
              code: 'pnpm add @mastra/sentry',
            },
          ],
        },
      ],
    },
  ],
  configure: params => [
    {
      title: t('Configure'),
      content: [
        {
          type: 'text',
          text: tct(
            'Configure Mastra to use Sentry by adding the [code:SentryExporter] to your Mastra observability config. For more details, see the [link:@mastra/sentry package].',
            {
              code: <code />,
              link: <ExternalLink href="https://www.npmjs.com/package/@mastra/sentry" />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: `import { Mastra } from '@mastra/core';
import { SentryExporter } from '@mastra/sentry';

const mastra = new Mastra({
  // ... your existing config
  observability: {
    configs: {
      sentry: {
        serviceName: 'my-service',
        exporters: [
          new SentryExporter({
            dsn: '${params.dsn.public}',
            // Tracing must be enabled for agent monitoring to work
            tracesSampleRate: 1.0,
          }),
        ],
      },
    },
  },
});`,
            },
          ],
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
          text: t('Verify that your instrumentation works by simply calling your LLM.'),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: `import { Agent } from '@mastra/core/agent';

// This agent needs to be registered in your Mastra config
const agent = new Agent({
  id: 'my-agent',
  name: 'My Agent',
  instructions: 'You are a helpful assistant',
  model: 'openai/gpt-5.4',
});

const result = await agent.generate([{ role: "user", content: "Hello!" }]);`,
            },
          ],
        },
      ],
    },
  ],
};

/**
 * Flue is a TypeScript agent framework (by the Astro team) that ships an
 * official Sentry blueprint (`flue add tooling sentry`). The blueprint generates
 * a `sentry.ts` module and installs the matching Sentry SDK, so the install step
 * is identical on Node and Cloudflare. Only how `sentry.ts` bootstraps the SDK
 * differs by runtime: `Sentry.init()` on Node vs. an `instrumentDurableObjectWithSentry`
 * extension on Cloudflare. Flue emits spans through `@flue/opentelemetry`, so once
 * Sentry is the OpenTelemetry tracer provider its calls are auto-instrumented -
 * there is no per-client wrapping like the other Cloudflare SDKs.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/node/agent-tracing/flue/
 */
export const flueOnboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Flue ships an official Sentry blueprint. Run it from your project root - it generates a [code:sentry.ts] module and installs the matching Sentry SDK along with [fluePackage].',
            {
              code: <code />,
              fluePackage: <code>@flue/opentelemetry</code>,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Blueprint',
              language: 'bash',
              code: 'flue add tooling sentry',
            },
          ],
        },
      ],
    },
  ],
  configure: params => {
    const isCloudflare = getDeploymentTarget(params) === DeploymentTarget.CLOUDFLARE;

    if (isCloudflare) {
      return [
        {
          title: t('Configure'),
          content: [
            {
              type: 'text',
              text: tct(
                'On Cloudflare the blueprint generates a [code:sentry.ts] that exports a [code:cloudflare] extension built on [code:instrumentDurableObjectWithSentry], initializing the SDK once per isolate from your Worker bindings. Store your DSN as a secret and re-export the extension from each agent.',
                {code: <code />}
              ),
            },
            {
              type: 'code',
              tabs: [
                {
                  label: 'Secret',
                  language: 'bash',
                  code: 'wrangler secret put SENTRY_DSN',
                },
              ],
            },
            {
              type: 'code',
              tabs: [
                {
                  label: 'agent.ts',
                  language: 'typescript',
                  code: `// Re-export the extension generated by the Sentry blueprint
export { cloudflare } from "../sentry.ts";`,
                },
              ],
            },
            {
              type: 'text',
              text: tct(
                'The blueprint only instruments your agents. Wrap the outer Worker with [code:withSentry] as well. See the [link:Flue on Cloudflare guide] for the full setup.',
                {
                  code: <code />,
                  link: <ExternalLink href={FLUE_CLOUDFLARE_AGENT_TRACING_DOCS} />,
                }
              ),
            },
          ],
        },
      ];
    }

    return [
      {
        title: t('Configure'),
        content: [
          {
            type: 'text',
            text: tct(
              'The blueprint generated a [code:sentry.ts] that calls [code:Sentry.init()] at module scope. Set your DSN, then import it once at the very top of your entry point so Sentry is the OpenTelemetry tracer provider before your agents run.',
              {code: <code />}
            ),
          },
          {
            type: 'code',
            tabs: [
              {
                label: '.env',
                language: 'bash',
                code: `SENTRY_DSN="${params.dsn.public}"
SENTRY_TRACES_SAMPLE_RATE=1`,
              },
            ],
          },
          {
            type: 'code',
            tabs: [
              {
                label: 'index.ts',
                language: 'typescript',
                code: 'import "./sentry.ts";',
              },
            ],
          },
          {
            type: 'text',
            text: tct('For more details, see the [link:Flue on Node guide].', {
              link: <ExternalLink href={FLUE_NODE_AGENT_TRACING_DOCS} />,
            }),
          },
        ],
      },
    ];
  },
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: tct(
            'Prompt one of your Flue agents that uses tools, then confirm a trace with [code:invoke_agent], [code:chat], and [code:execute_tool] spans (including token usage) shows up in Sentry.',
            {code: <code />}
          ),
        },
      ],
    },
  ],
};

/**
 * Eve is Vercel's filesystem-first framework for durable backend AI agents. It
 * doesn't use `Sentry.init` - its `eve add instrumentation/sentry` command
 * generates an `agent/instrumentation.ts` that wires `@vercel/otel` to Sentry's
 * OTLP traces endpoint, reading the endpoint and public key from the
 * environment. Eve runs on Node only.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/node/agent-tracing/eve/
 */
export const eveOnboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Add the Sentry instrumentation to your Eve project. This generates [code:agent/instrumentation.ts] and installs the required OpenTelemetry packages.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'bash',
              language: 'bash',
              code: 'eve add instrumentation/sentry',
            },
          ],
        },
      ],
    },
  ],
  configure: params => {
    // `dsn.public` is the full DSN; Eve's `x-sentry-auth` header only needs the
    // public key portion (the DSN's userinfo).
    const publicKey = new URL(params.dsn.public).username;

    return [
      {
        title: t('Configure'),
        content: [
          {
            type: 'text',
            text: tct(
              'The generated [code:agent/instrumentation.ts] reads your Sentry OTLP endpoint and public key from the environment. Set these variables so Eve exports traces to Sentry:',
              {
                code: <code />,
              }
            ),
          },
          {
            type: 'code',
            tabs: [
              {
                label: 'bash',
                language: 'bash',
                code: [
                  `SENTRY_OTLP_TRACES_ENDPOINT="${params.dsn.otlp_traces}"`,
                  `SENTRY_PUBLIC_KEY="${publicKey}"`,
                ].join('\n'),
              },
            ],
          },
          {
            type: 'text',
            text: tct(
              'For reference, the generated instrumentation looks like this. See the [link:Eve docs] for details.',
              {
                link: <ExternalLink href={EVE_AGENT_TRACING_DOCS} />,
              }
            ),
          },
          {
            type: 'code',
            tabs: [
              {
                label: 'agent/instrumentation.ts',
                language: 'typescript',
                code: `import { OTLPHttpProtoTraceExporter, registerOTel } from "@vercel/otel";
import { defineInstrumentation } from "eve/instrumentation";

export default defineInstrumentation({
  // Capture prompts and responses; set either to false to omit them.
  recordInputs: true,
  recordOutputs: true,
  setup: ({ agentName }) =>
    registerOTel({
      serviceName: agentName,
      traceExporter: new OTLPHttpProtoTraceExporter({
        url: process.env.SENTRY_OTLP_TRACES_ENDPOINT!,
        headers: {
          "x-sentry-auth": \`sentry sentry_key=\${process.env.SENTRY_PUBLIC_KEY}\`,
        },
      }),
    }),
});`,
              },
            ],
          },
        ],
      },
    ];
  },
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Start Eve and send a prompt that calls a tool. The agent run shows up as AI spans in Sentry.'
          ),
        },
      ],
    },
  ],
};

export function getManualConfigureStep(
  params: DocsParams,
  {
    packageName = '@sentry/node',
    importMode,
    configFileName,
    sentryImport,
    docUrl = 'https://docs.sentry.io/platforms/node/tracing/instrumentation/ai-agents-module/#manual-instrumentation',
  }: {
    configFileName?: string;
    docUrl?: string;
    importMode?: 'esm' | 'cjs' | 'esm-only';
    packageName?: `@sentry/${string}`;
    sentryImport?: string;
  } = {}
): OnboardingStep[] {
  const isCloudflare = getDeploymentTarget(params) === DeploymentTarget.CLOUDFLARE;
  const importStatement = sentryImport ?? getImport(packageName, importMode).join('\n');

  const code = isCloudflare
    ? getCloudflareConfigureSnippet({dsn: params.dsn.public})
    : `${importStatement}

Sentry.init({
  dsn: "${params.dsn.public}",
  // Tracing must be enabled for agent monitoring to work
  tracesSampleRate: 1.0,
  dataCollection: {
    // Control data collection of LLMs and tools.
    // For more info visit: https://docs.sentry.io/platforms/javascript/data-management/data-collected/
    // genAI: { inputs: false, outputs: false },
  },
});`;

  return [
    {
      title: t('Configure'),
      content: [
        {
          type: 'text',
          text: t('Initialize the Sentry SDK in the entry point of your application.'),
        },
        {
          type: 'code',
          tabs: [
            {
              label: configFileName ?? 'JavaScript',
              language: 'javascript',
              code,
            },
          ],
        },
        ...(isCloudflare ? [getDurableObjectsNote()] : []),
        {
          type: 'custom',
          content: (
            <ManualInstrumentationNote
              docsLink={
                <ExternalLink
                  href={isCloudflare ? CLOUDFLARE_AGENT_TRACING_DOCS : docUrl}
                />
              }
            />
          ),
        },
      ],
    },
  ];
}

export function getInstallStep(
  params: DocsParams,
  {
    packageName = '@sentry/node',
    minVersion = MIN_REQUIRED_VERSION,
  }: {
    minVersion?: string;
    packageName?: `@sentry/${string}`;
  } = {}
): OnboardingStep[] {
  const selected = getAgentIntegration(params);

  if (selected === AgentIntegration.MASTRA) {
    return mastraOnboarding.install(params);
  }

  if (selected === AgentIntegration.FLUE) {
    return flueOnboarding.install(params);
  }

  if (selected === AgentIntegration.EVE) {
    return eveOnboarding.install(params);
  }

  const resolvedPackageName =
    getDeploymentTarget(params) === DeploymentTarget.CLOUDFLARE
      ? '@sentry/cloudflare'
      : packageName;
  const resolvedMinVersion = getMinRequiredVersion(params, minVersion);

  return [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'To enable agent monitoring, you need to install the Sentry SDK with a minimum version of [minVersion].',
            {
              minVersion: <code>{resolvedMinVersion}</code>,
            }
          ),
        },
        getInstallCodeBlock(params, {
          packageName: resolvedPackageName,
        }),
      ],
    },
  ];
}

/**
 * The Cloudflare Agents SDK is bootstrapped by wrapping the agent class with
 * `instrumentAgentWithSentry` (Durable Object instrumentation under the hood),
 * a different entry point than `withSentry`, so it gets its own configure step.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/cloudflare/features/agents-sdk/
 */
function getCloudflareAgentsConfigureStep(params: DocsParams): OnboardingStep[] {
  return [
    {
      title: t('Configure'),
      content: [
        {
          type: 'text',
          text: tct(
            'Wrap your agent class with [code:Sentry.instrumentAgentWithSentry]. It applies Durable Object instrumentation plus agent-specific telemetry, including callable RPC spans and automatic conversation ID tracking.',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: `import * as Sentry from "@sentry/cloudflare";
import { Agent } from "agents";

class MyAgentBase extends Agent {
  // Your agent logic goes here
}

// Wrap the agent so its RPC calls and model invocations are captured as AI spans
export const MyAgent = Sentry.instrumentAgentWithSentry(
  (env) => ({
    dsn: "${params.dsn.public}",
    // Tracing must be enabled for agent monitoring to work
    tracesSampleRate: 1.0,
    // Propagate traces across callable RPC methods
    enableRpcTracePropagation: true,
  }),
  MyAgentBase,
);`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'The wrapper also supports [aiChatAgent:AIChatAgent] and [mcpAgent:McpAgent]. For per-user or singleton agents, call [code:Sentry.setConversationId] at the start of [code:onChatMessage] to override the automatic conversation ID. See the [link:Agents SDK docs] for details.',
            {
              code: <code />,
              aiChatAgent: <code />,
              mcpAgent: <code />,
              link: <ExternalLink href={CLOUDFLARE_AGENTS_SDK_DOCS} />,
            }
          ),
        },
      ],
    },
  ];
}

function getConfigureStep({
  params,
  integration,
  packageName,
  configFileName,
}: {
  integration: AgentIntegration;
  packageName: `@sentry/${string}`;
  params: DocsParams;
  configFileName?: string;
}): OnboardingStep[] {
  const vercelAiExtraInstrumentation: ContentBlock[] =
    integration === AgentIntegration.VERCEL_AI
      ? [
          {
            type: 'text',
            text: tct(
              'When using [code:generateText], [code:generateObject], or [code:streamText], pass the [code:experimental_telemetry] object to correctly capture spans. For the [code:ToolLoopAgent] class, telemetry is configured via the constructor. For more details, see the [telemetryLink:AI SDK Telemetry Metadata docs] and the [agentLink:ToolLoopAgent docs].',
              {
                code: <code />,
                telemetryLink: (
                  <ExternalLink href="https://sdk.vercel.ai/docs/ai-sdk-core/telemetry#telemetry-metadata" />
                ),
                agentLink: (
                  <ExternalLink href="https://ai-sdk.dev/docs/agents/overview#toolloopagent-class" />
                ),
              }
            ),
          },
          {
            type: 'code',
            tabs: [
              {
                label: 'generateText',
                language: 'javascript',
                code: `const { generateText } = require('ai');
const { openai } = require('@ai-sdk/openai');

const result = await generateText({
  model: openai("gpt-5.4"),
  prompt: "Tell me a joke",
  experimental_telemetry: {
    isEnabled: true,
    functionId: "joke_agent",
    recordInputs: true,
    recordOutputs: true,
  },
});`,
              },
              {
                label: 'ToolLoopAgent',
                language: 'javascript',
                code: `const { ToolLoopAgent, tool } = require("ai");
const { z } = require("zod");

const agent = new ToolLoopAgent({
  model: "openai/gpt-5.4",
  tools: {
    weather: tool({
      description: "Get the weather in a location",
      inputSchema: z.object({
        location: z.string().describe("The location to get the weather for"),
      }),
      execute: async ({ location }) => ({
        location,
        temperature: 72 + Math.floor(Math.random() * 21) - 10,
      }),
    }),
  },
  telemetry: {
    isEnabled: true,
    functionId: "weather_agent",
    recordInputs: true,
    recordOutputs: true,
  },
});

const result = await agent.generate({
  prompt: "What is the weather in San Francisco?",
});`,
              },
            ],
          },
        ]
      : [];

  const isCloudflare = getDeploymentTarget(params) === DeploymentTarget.CLOUDFLARE;
  const isCloudflareWrap =
    isCloudflare && CLOUDFLARE_WRAP_INTEGRATIONS.includes(integration);
  const isCloudflareWorkersAi =
    isCloudflare && integration === AgentIntegration.WORKERS_AI;

  const configureCode = isCloudflare
    ? getCloudflareConfigureSnippet({dsn: params.dsn.public, integration})
    : `${getImport(packageName).join('\n')}

Sentry.init({
  dsn: "${params.dsn.public}",
  // Tracing must be enabled for agent monitoring to work
  tracesSampleRate: 1.0,
  dataCollection: {
    // Control data collection of LLMs and tools.
    // For more info visit: https://docs.sentry.io/platforms/javascript/data-management/data-collected/
    // genAI: { inputs: false, outputs: false },
  },
});`;

  // On Node the SDK auto-instruments the integration; on Cloudflare the worker is
  // wrapped and (for most SDKs) the client is instrumented explicitly below.
  const introText = isCloudflare
    ? t('Wrap your Worker with the Sentry SDK:')
    : tct(
        'Import and initialize the Sentry SDK - the [integration] will be enabled automatically:',
        {
          integration: AGENT_INTEGRATION_LABELS[integration] ?? integration,
        }
      );

  return [
    {
      title: t('Configure'),
      content:
        integration === AgentIntegration.MASTRA
          ? (mastraOnboarding.configure(params)[0]?.content ?? [])
          : [
              {
                type: 'text',
                text: introText,
              },
              {
                type: 'code',
                tabs: [
                  {
                    label: configFileName ?? 'JavaScript',
                    language: 'javascript',
                    code: configureCode,
                  },
                ],
              },
              ...(isCloudflareWorkersAi ? [getWorkersAiNote()] : []),
              ...(isCloudflare ? [getDurableObjectsNote()] : []),
              ...(isCloudflareWrap ? getCloudflareWrapBlocks(integration) : []),
              ...vercelAiExtraInstrumentation,
            ],
    },
  ];
}

function getVerifyStep(params: DocsParams): OnboardingStep[] {
  const selected = getAgentIntegration(params);

  if (selected === AgentIntegration.MASTRA) {
    return mastraOnboarding.verify(params);
  }

  if (selected === AgentIntegration.FLUE) {
    return flueOnboarding.verify(params);
  }

  if (selected === AgentIntegration.EVE) {
    return eveOnboarding.verify(params);
  }

  // The Agents SDK only produces spans once the wrapped agent runs, so there's
  // no standalone snippet to verify - trigger the agent instead.
  if (selected === AgentIntegration.CLOUDFLARE_AGENTS) {
    return [
      {
        type: StepType.VERIFY,
        content: [
          {
            type: 'text',
            text: t(
              'Trigger your agent so it invokes a model, then confirm the agent spans show up in Sentry.'
            ),
          },
        ],
      },
    ];
  }

  // On Cloudflare these SDKs only produce spans through the wrapped client shown
  // in the Configure step, so the raw-SDK verify snippets below don't apply.
  const isCloudflareWrap =
    getDeploymentTarget(params) === DeploymentTarget.CLOUDFLARE &&
    CLOUDFLARE_WRAP_INTEGRATIONS.includes(selected);

  const content: ContentBlock[] = [
    {
      type: 'text',
      text: isCloudflareWrap
        ? t(
            'Trigger your Worker so it makes an AI call through the wrapped client, then confirm the agent spans show up in Sentry.'
          )
        : t('Verify that your instrumentation works by simply calling your LLM.'),
    },
  ];

  if (isCloudflareWrap) {
    return [
      {
        type: StepType.VERIFY,
        content,
      },
    ];
  }

  if (selected === AgentIntegration.ANTHROPIC) {
    content.push({
      type: 'code',
      tabs: [
        {
          label: 'JavaScript',
          language: 'javascript',
          code: `const Anthropic = require("@anthropic-ai/sdk");
const client = new Anthropic();

const msg = await client.messages.create({
  messages: [{ role: "user", content: "Tell me a joke" }],
  model: "claude-sonnet-4-6",
});`,
        },
      ],
    });
  }

  if (selected === AgentIntegration.OPENAI) {
    content.push({
      type: 'code',
      tabs: [
        {
          label: 'JavaScript',
          language: 'javascript',
          code: `const OpenAI = require("openai");
const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-5.4",
  input: "Tell me a joke",
});`,
        },
      ],
    });
  }

  if (selected === AgentIntegration.WORKERS_AI) {
    content.push({
      type: 'code',
      tabs: [
        {
          label: 'JavaScript',
          language: 'javascript',
          code: `// Inside your withSentry fetch handler, call the AI binding:
const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
  messages: [{ role: "user", content: "What is the capital of France?" }],
});`,
        },
      ],
    });
  }

  if (selected === AgentIntegration.GOOGLE_GENAI) {
    content.push({
      type: 'code',
      tabs: [
        {
          label: 'JavaScript',
          language: 'javascript',
          code: `const GoogleGenAI = require("@google/genai").GoogleGenAI;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const response = await ai.models.generateContent({
  model: 'gemini-3-flash-preview',
  contents: 'Why is the sky blue?',
});`,
        },
      ],
    });
  }

  if (selected === AgentIntegration.LANGCHAIN) {
    content.push({
      type: 'code',
      tabs: [
        {
          label: 'JavaScript',
          language: 'javascript',
          code: `const { ChatOpenAI } = require("@langchain/openai");
const { HumanMessage, SystemMessage } = require("@langchain/core/messages");

const chatModel = new ChatOpenAI({
  modelName: "gpt-5.4",
  apiKey: process.env.OPENAI_API_KEY,
});

const messages = [
  new SystemMessage("You are a helpful assistant."),
  new HumanMessage("Tell me a joke"),
];

const response = await chatModel.invoke(messages);
const text = response.content;`,
        },
      ],
    });
  }

  if (selected === AgentIntegration.LANGGRAPH) {
    content.push({
      type: 'code',
      tabs: [
        {
          label: 'JavaScript',
          language: 'javascript',
          code: `const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { ChatOpenAI } = require("@langchain/openai");

const model = new ChatOpenAI({ modelName: "gpt-5.4" });

// Setting the agent name helps Sentry identify and group agent activity
const agent = createReactAgent({
  llm: model,
  tools: [],
  name: "joke_agent",
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "Tell me a joke" }],
});

const messages = result.messages;
const lastMessage = messages[messages.length - 1];
const text = lastMessage.content;`,
        },
      ],
    });
  }

  return [
    {
      type: StepType.VERIFY,
      content,
    },
  ];
}

export const agentMonitoring = ({
  packageName = '@sentry/node',
  configFileName,
}: {
  configFileName?: string;
  packageName?: `@sentry/${string}`;
} = {}): OnboardingConfig => ({
  introduction: params => (
    <SdkUpdateAlert
      projectId={params.project.id}
      minVersion={getMinRequiredVersion(params, MIN_REQUIRED_VERSION)}
      packageName={packageName}
    />
  ),
  install: params =>
    getInstallStep(params, {
      packageName,
      minVersion: MIN_REQUIRED_VERSION,
    }),
  configure: params => {
    const selected = getAgentIntegration(params);

    if (selected === AgentIntegration.MANUAL) {
      return getManualConfigureStep(params, {
        packageName,
      });
    }

    if (selected === AgentIntegration.FLUE) {
      return flueOnboarding.configure(params);
    }

    if (selected === AgentIntegration.EVE) {
      return eveOnboarding.configure(params);
    }

    if (selected === AgentIntegration.CLOUDFLARE_AGENTS) {
      return getCloudflareAgentsConfigureStep(params);
    }

    return getConfigureStep({
      params,
      integration: selected,
      packageName,
      configFileName,
    });
  },
  verify: getVerifyStep,
});

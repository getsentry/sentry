import {ExternalLink} from 'sentry/components/core/link';
import {
  StepType,
  type ContentBlock,
  type DocsParams,
  type OnboardingConfig,
  type OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {javascriptMetaFrameworks} from 'sentry/data/platformCategories';
import {getImport, getInstallCodeBlock} from 'sentry/gettingStartedDocs/node/utils';
import {t, tct} from 'sentry/locale';
import {CopyLLMPromptButton} from 'sentry/views/insights/pages/agents/llmOnboardingInstructions';
import {
  AGENT_INTEGRATION_LABELS,
  AgentIntegration,
} from 'sentry/views/insights/pages/agents/utils/agentIntegrations';

export function getAgentIntegration(params: DocsParams): AgentIntegration {
  return (params.platformOptions?.integration ??
    AgentIntegration.VERCEL_AI) as AgentIntegration;
}

export function getManualConfigureStep(
  params: DocsParams,
  {
    packageName = '@sentry/node',
    importMode,
  }: {
    importMode?: 'esm' | 'cjs' | 'esm-only';
    packageName?: `@sentry/${string}`;
  } = {}
): OnboardingStep[] {
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
              label: 'JavaScript',
              language: 'javascript',
              code: `${getImport(packageName, importMode).join('\n')}

Sentry.init({
  dsn: "${params.dsn.public}",
  // Tracing must be enabled for agent monitoring to work
  tracesSampleRate: 1.0,
  // Add data like inputs and responses to/from LLMs and tools;
  // see https://docs.sentry.io/platforms/javascript/data-management/data-collected/ for more info
  sendDefaultPii: true,
});`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'Then follow the [link:manual instrumentation guide] to instrument your AI calls, or use an AI coding agent to do it for you.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/node/tracing/instrumentation/ai-agents-module/#manual-instrumentation" />
              ),
            }
          ),
        },
        {
          type: 'custom',
          content: <CopyLLMPromptButton />,
        },
      ],
    },
  ];
}

export function getInstallStep(
  params: DocsParams,
  {
    packageName = '@sentry/node',
    minVersion = '10.28.0',
  }: {
    minVersion?: string;
    packageName?: `@sentry/${string}`;
  } = {}
): OnboardingStep[] {
  const selected = getAgentIntegration(params);

  if (selected === AgentIntegration.MASTRA) {
    return [
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
    ];
  }

  return [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'To enable agent monitoring, you need to install the Sentry SDK with a minimum version of [minVersion].',
            {
              minVersion: <code>{minVersion}</code>,
            }
          ),
        },
        getInstallCodeBlock(params, {
          packageName,
        }),
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
  // Meta-frameworks can run on multiple runtimes (Node.js server-side, Browser client-side, etc.).
  // We only show Node.js instructions here to keep onboarding simple.
  // For other runtimes, we show an alert linking to the docs.
  const isMetaFramework = javascriptMetaFrameworks.includes(params.platformKey);

  const manualInstrumentationAlert: ContentBlock[] = isMetaFramework
    ? [
        {
          type: 'alert',
          alertType: 'info',
          text: tct(
            "Below you'll find setup instructions for server-side on Node.js. For other runtimes, like the Browser, the instrumentation needs to be manually enabled. [link:See the docs] for more information.",
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/ai-agent-monitoring-browser/" />
              ),
            }
          ),
        },
      ]
    : [];

  const vercelAiExtraInstrumentation: ContentBlock[] =
    integration === AgentIntegration.VERCEL_AI
      ? [
          {
            type: 'text',
            text: tct(
              'To correctly capture spans, pass the [code:experimental_telemetry] object to every [code:generateText], [code:generateObject], and [code:streamText] function call. For more details, see the [link:AI SDK Telemetry Metadata docs].',
              {
                code: <code />,
                link: (
                  <ExternalLink href="https://sdk.vercel.ai/docs/ai-sdk-core/telemetry#telemetry-metadata" />
                ),
              }
            ),
          },
          {
            type: 'code',
            tabs: [
              {
                label: 'JavaScript',
                language: 'javascript',
                code: `const { generateText } = require('ai');
const { openai } = require('@ai-sdk/openai');

const result = await generateText({
  model: openai("gpt-4o"),
  prompt: "Tell me a joke",
  experimental_telemetry: {
    isEnabled: true,
    recordInputs: true,
    recordOutputs: true,
  },
});`,
              },
            ],
          },
        ]
      : [];

  return [
    {
      title: t('Configure'),
      content:
        integration === AgentIntegration.MASTRA
          ? [
              {
                type: 'text',
                text: tct(
                  'Configure Mastra to use Sentry by adding the [code:SentryExporter] to your Mastra observability config. For more details, see the [link:@mastra/sentry package].',
                  {
                    code: <code />,
                    link: (
                      <ExternalLink href="https://www.npmjs.com/package/@mastra/sentry" />
                    ),
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
            ]
          : [
              ...manualInstrumentationAlert,
              {
                type: 'text',
                text: tct(
                  'Import and initialize the Sentry SDK - the [integration] will be enabled automatically:',
                  {
                    integration: AGENT_INTEGRATION_LABELS[integration] ?? integration,
                  }
                ),
              },
              {
                type: 'code',
                tabs: [
                  {
                    label: configFileName ?? 'JavaScript',
                    language: 'javascript',
                    code: `${getImport(packageName).join('\n')}

Sentry.init({
  dsn: "${params.dsn.public}",
  // Tracing must be enabled for agent monitoring to work
  tracesSampleRate: 1.0,
  // Add data like inputs and responses to/from LLMs and tools;
  // see https://docs.sentry.io/platforms/javascript/data-management/data-collected/ for more info
  sendDefaultPii: true,
});`,
                  },
                ],
              },
              ...vercelAiExtraInstrumentation,
            ],
    },
  ];
}

function getVerifyStep(params: DocsParams): OnboardingStep[] {
  const content: ContentBlock[] = [
    {
      type: 'text',
      text: t('Verify that your instrumentation works by simply calling your LLM.'),
    },
  ];

  const selected = getAgentIntegration(params);

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
  model: "claude-sonnet-4-5-20250929",
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
  model: "gpt-4o-mini",
  input: "Tell me a joke",
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
  model: 'gemini-2.5-flash-lite',
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
  modelName: "gpt-4o",
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
          code: `const { ChatOpenAI } = require("@langchain/openai");
const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { HumanMessage, SystemMessage } = require("@langchain/core/messages");

const llm = new ChatOpenAI({
  modelName: "gpt-4o",
  apiKey: process.env.OPENAI_API_KEY,
});

const agent = createReactAgent({ llm, tools: [] });

const result = await agent.invoke({
  messages: [
    new SystemMessage("You are a helpful assistant."),
    new HumanMessage("Tell me a joke")
  ],
});

const messages = result.messages;
const lastMessage = messages[messages.length - 1];
const text = lastMessage.content;`,
        },
      ],
    });
  }

  if (selected === AgentIntegration.MASTRA) {
    content.push({
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
  model: 'openai/gpt-4o',
});

const result = await agent.generate([{ role: "user", content: "Hello!" }]);`,
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
  install: params =>
    getInstallStep(params, {
      packageName,
    }),
  configure: params => {
    const selected = getAgentIntegration(params);

    if (selected === AgentIntegration.MANUAL) {
      return getManualConfigureStep(params, {
        packageName,
      });
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

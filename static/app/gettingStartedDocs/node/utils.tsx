import {ExternalLink} from 'sentry/components/core/link';
import type {
  BasePlatformOptions,
  ContentBlock,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {javascriptMetaFrameworks} from 'sentry/data/platformCategories';
import {t, tct} from 'sentry/locale';
import {CopyLLMPromptButton} from 'sentry/views/insights/pages/agents/llmOnboardingInstructions';
import {
  AGENT_INTEGRATION_LABELS,
  AgentIntegration,
} from 'sentry/views/insights/pages/agents/utils/agentIntegrations';

function getInstallSnippet({
  params,
  packageManager,
  additionalPackages = [],
  packageName = '@sentry/node',
}: {
  packageManager: 'npm' | 'yarn' | 'pnpm';
  params: DocsParams;
  additionalPackages?: Array<`@sentry/${string}`>;
  packageName?: `@sentry/${string}`;
}) {
  let packages = [packageName];
  if (params.isProfilingSelected) {
    packages.push('@sentry/profiling-node');
  }
  packages = packages.concat(additionalPackages);

  if (packageManager === 'yarn') {
    return `yarn add ${packages.join(' ')}`;
  }

  if (packageManager === 'pnpm') {
    return `pnpm add ${packages.join(' ')}`;
  }

  return `npm install ${packages.join(' ')} --save`;
}

export function getInstallCodeBlock(
  params: DocsParams,
  {
    packageName = '@sentry/node',
    additionalPackages,
  }: {
    additionalPackages?: Array<`@sentry/${string}`>;
    packageName?: `@sentry/${string}`;
  } = {}
): ContentBlock {
  return {
    type: 'code',
    tabs: [
      {
        label: 'npm',
        language: 'bash',
        code: getInstallSnippet({
          params,
          additionalPackages,
          packageManager: 'npm',
          packageName,
        }),
      },
      {
        label: 'yarn',
        language: 'bash',
        code: getInstallSnippet({
          params,
          additionalPackages,
          packageManager: 'yarn',
          packageName,
        }),
      },
      {
        label: 'pnpm',
        language: 'bash',
        code: getInstallSnippet({
          params,
          additionalPackages,
          packageManager: 'pnpm',
          packageName,
        }),
      },
    ],
  };
}

function getImport(
  packageName: `@sentry/${string}`,
  importMode?: 'esm' | 'cjs' | 'esm-only'
): string[] {
  if (importMode === 'esm-only') {
    return [`import * as Sentry from "${packageName}";`];
  }
  return importMode === 'esm'
    ? [
        `// Import with \`const Sentry = require("${packageName}");\` if you are using CJS`,
        `import * as Sentry from "${packageName}"`,
      ]
    : [
        `// Import with \`import * as Sentry from "${packageName}"\` if you are using ESM`,
        `const Sentry = require("${packageName}");`,
      ];
}

function getProfilingImport(defaultMode?: 'esm' | 'cjs'): string {
  return defaultMode === 'esm'
    ? `import { nodeProfilingIntegration } from "@sentry/profiling-node";`
    : `const { nodeProfilingIntegration } = require("@sentry/profiling-node");`;
}

/**
 * Import Snippet for the Node and Serverless SDKs without other packages (like profiling).
 */
export function getSentryImportSnippet(
  packageName: `@sentry/${string}`,
  defaultMode?: 'esm' | 'cjs'
): string {
  return getImport(packageName, defaultMode).join('\n');
}

export function getImportInstrumentSnippet(
  defaultMode?: 'esm' | 'cjs',
  fileExtension = 'js'
): string {
  const filename = `instrument.${fileExtension}`;

  return defaultMode === 'esm'
    ? `// IMPORTANT: Make sure to import \`${filename}\` at the top of your file.
// If you're using CommonJS (CJS) syntax, use \`require("./${filename}");\`
import "./${filename}";`
    : `// IMPORTANT: Make sure to import \`${filename}\` at the top of your file.
// If you're using ECMAScript Modules (ESM) syntax, use \`import "./${filename}";\`
require("./${filename}");`;
}

const libraryMap = {
  node: '@sentry/node',
  aws: '@sentry/aws-serverless',
  gpc: '@sentry/google-cloud-serverless',
  nestjs: '@sentry/nestjs',
} as const;

function getDefaultNodeImports({
  params,
  sdkImport,
  defaultMode,
}: {
  params: DocsParams;
  sdkImport: 'node' | 'aws' | 'gpc' | 'nestjs' | null;
  defaultMode?: 'esm' | 'cjs';
}) {
  if (sdkImport === null || !libraryMap[sdkImport]) {
    return '';
  }
  const imports: string[] = getImport(libraryMap[sdkImport], defaultMode);

  if (params.isProfilingSelected) {
    imports.push(getProfilingImport(defaultMode));
  }
  return imports.join('\n');
}

export const getNodeProfilingOnboarding = ({
  packageName = '@sentry/node',
  profilingLifecycle = 'trace',
}: {
  packageName?: `@sentry/${string}`;
  profilingLifecycle?: 'trace' | 'manual';
} = {}): OnboardingConfig => ({
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'To enable profiling, add [code:@sentry/profiling-node] to your imports.',
            {
              code: <code />,
            }
          ),
        },
        getInstallCodeBlock(params, {
          packageName,
        }),
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Set up the [code:nodeProfilingIntegration] in your [code:Sentry.init()] call.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Javascript',
              value: 'javascript',
              language: 'javascript',
              code: `
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

Sentry.init({
  dsn: "${params.dsn.public}",
  integrations: [
    nodeProfilingIntegration(),
  ],${
    params.profilingOptions?.defaultProfilingMode === 'continuous'
      ? profilingLifecycle === 'trace'
        ? `
  // Tracing must be enabled for profiling to work
  tracesSampleRate: 1.0,
  // Set sampling rate for profiling - this is evaluated only once per SDK.init call
  profileSessionSampleRate: 1.0,
  // Trace lifecycle automatically enables profiling during active traces
  profileLifecycle: 'trace',`
        : `
  // Tracing is not required for profiling to work
  // but for the best experience we recommend enabling it
  tracesSampleRate: 1.0,
  // Set sampling rate for profiling - this is evaluated only once per SDK.init call
  profileSessionSampleRate: 1.0,`
      : `
  // Tracing must be enabled for profiling to work
  tracesSampleRate: 1.0,
  // Set sampling rate for profiling - this is evaluated only once per SDK.init call
  profilesSampleRate: 1.0,`
  }

  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});${
                params.profilingOptions?.defaultProfilingMode === 'continuous' &&
                profilingLifecycle === 'trace'
                  ? `

// Profiling happens automatically after setting it up with \`Sentry.init()\`.
// All spans (unless those discarded by sampling) will have profiling data attached to them.
Sentry.startSpan({
  name: "My Span",
}, () => {
  // The code executed here will be profiled
});`
                  : ''
              }${
                params.profilingOptions?.defaultProfilingMode === 'continuous' &&
                profilingLifecycle === 'manual'
                  ? `

Sentry.profiler.startProfiler();
// Code executed between these two calls will be profiled
Sentry.profiler.stopProfiler();
                  `
                  : ''
              }`,
            },
          ],
        },
        {
          type: 'conditional',
          condition: profilingLifecycle === 'trace',
          content: [
            {
              type: 'text',
              text: tct(
                'If you need more fine grained control over which spans are profiled, you can do so by [link:enabling manual lifecycle profiling].',
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/node/profiling/node-profiling/#enabling-manual-lifecycle-profiling" />
                  ),
                }
              ),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'For more detailed information on profiling, see the [link:profiling documentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/node/profiling/node-profiling/" />
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
          text: t(
            'Verify that profiling is working correctly by simply using your application.'
          ),
        },
      ],
    },
  ],
});

const getBrowserAgentMonitoringOnboardingConfiguration = ({
  integration,
  packageName,
  importMode,
}: {
  integration: AgentIntegration;
  packageName: `@sentry/${string}`;
  importMode?: 'esm' | 'cjs' | 'esm-only';
}): ContentBlock[] => {
  if (integration === AgentIntegration.LANGGRAPH) {
    return [
      {
        type: 'text',
        text: tct(
          'Then follow the [manualSpanCreationDoc:manual custom spans] to instrument your AI calls, or use the [code:instrumentLangGraph] helper:',
          {
            manualSpanCreationDoc: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/tracing/instrumentation/ai-agents-module-browser/#manual-span-creation" />
            ),
            code: <code />,
          }
        ),
      },
      {
        type: 'code',
        tabs: [
          {
            label: 'JavaScript',
            language: 'javascript',
            code: `${getImport(packageName, importMode).join('\n')}
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const llm = new ChatOpenAI({
  modelName: "gpt-4o",
  // WARNING: Never expose API keys in browser code
  apiKey: "YOUR_OPENAI_API_KEY",
});

const agent = createReactAgent({ llm, tools: [] });

Sentry.instrumentLangGraph(agent, {
  recordInputs: true,
  recordOutputs: true,
});

const result = await agent.invoke({
  messages: [
    new SystemMessage("You are a helpful assistant."),
    new HumanMessage("Tell me a joke")
  ],
});

const messages = result.messages;
const lastMessage = messages[messages.length - 1];
const text = lastMessage.content;
            `,
          },
        ],
      },
    ];
  }

  if (integration === AgentIntegration.LANGCHAIN) {
    return [
      {
        type: 'text',
        text: tct(
          'Then follow the [manualSpanCreationDoc:manual custom spans] to instrument your AI calls, or use the [code:createLangChainCallbackHandler] helper:',
          {
            manualSpanCreationDoc: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/tracing/instrumentation/ai-agents-module-browser/#manual-span-creation" />
            ),
            code: <code />,
          }
        ),
      },
      {
        type: 'code',
        tabs: [
          {
            label: 'JavaScript',
            language: 'javascript',
            code: `${getImport(packageName, importMode).join('\n')}
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";


// Create a LangChain callback handler
const callbackHandler = Sentry.createLangChainCallbackHandler({
  recordInputs: true, // Optional: record input prompts/messages
  recordOutputs: true, // Optional: record output responses
});

const chatModel = new ChatOpenAI({
  modelName: "gpt-4o",
  // WARNING: Never expose API keys in browser code
  apiKey: "YOUR_OPENAI_API_KEY",
});

const messages = [
  new SystemMessage("You are a helpful assistant."),
  new HumanMessage("Tell me a joke"),
];

const response = await chatModel.invoke(messages, {
  callbacks: [callbackHandler],
});
const text = response.content;
            `,
          },
        ],
      },
    ];
  }

  if (integration === AgentIntegration.GOOGLE_GENAI) {
    return [
      {
        type: 'text',
        text: tct(
          'Then follow the [manualSpanCreationDoc:manual custom spans] to instrument your AI calls, or use the [code:instrumentGoogleGenAIClient] helper:',
          {
            manualSpanCreationDoc: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/tracing/instrumentation/ai-agents-module-browser/#manual-span-creation" />
            ),
            code: <code />,
          }
        ),
      },
      {
        type: 'code',
        tabs: [
          {
            label: 'JavaScript',
            language: 'javascript',
            code: `${getImport(packageName, importMode).join('\n')}
import { GoogleGenAI } from "@google/genai";

// WARNING: Never expose API keys in browser code
const genAI = new GoogleGenAI("YOUR_GOOGLE_API_KEY");

const client = Sentry.instrumentGoogleGenAIClient(genAI, {
  recordInputs: true,
  recordOutputs: true,
});

const response = await client.models.generateContent({
  model: 'gemini-2.0-flash-001',
  contents: 'Why is the sky blue?',
});
            `,
          },
        ],
      },
    ];
  }

  if (integration === AgentIntegration.ANTHROPIC) {
    return [
      {
        type: 'text',
        text: tct(
          'Then follow the [manualSpanCreationDoc:manual custom spans] to instrument your AI calls, or use the [code:instrumentAnthropicAiClient] helper:',
          {
            manualSpanCreationDoc: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/tracing/instrumentation/ai-agents-module-browser/#manual-span-creation" />
            ),
            code: <code />,
          }
        ),
      },
      {
        type: 'code',
        tabs: [
          {
            label: 'JavaScript',
            language: 'javascript',
            code: `${getImport(packageName, importMode).join('\n')}
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const client = Sentry.instrumentAnthropicAiClient(anthropic, {
  recordInputs: true,
  recordOutputs: true,
});

const msg = await client.messages.create({
 model: "claude-3-5-sonnet",
 messages: [{role: "user", content: "Tell me a joke"}],
});
            `,
          },
        ],
      },
    ];
  }

  if (integration === AgentIntegration.OPENAI) {
    return [
      {
        type: 'text',
        text: tct(
          'Then follow the [manualSpanCreationDoc:manual custom spans] to instrument your AI calls, or use the [code:instrumentOpenAiClient] helper:',
          {
            manualSpanCreationDoc: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/tracing/instrumentation/ai-agents-module-browser/#manual-span-creation" />
            ),
            code: <code />,
          }
        ),
      },
      {
        type: 'code',
        tabs: [
          {
            label: 'JavaScript',
            language: 'javascript',
            code: `${getImport(packageName, importMode).join('\n')}
import OpenAI from "openai";

const openai = new OpenAI();

const client = Sentry.instrumentOpenAiClient(openai, {
  recordInputs: true,
  recordOutputs: true,
});

const response = await client.responses.create({
  model: "gpt-4o-mini",
  input: "Tell me a joke",
});
            `,
          },
        ],
      },
    ];
  }

  return [];
};

export const getNodeAgentMonitoringOnboarding = ({
  packageName = '@sentry/node',
  configFileName,
  importMode,
}: {
  configFileName?: string;
  importMode?: 'esm' | 'cjs' | 'esm-only';
  packageName?: `@sentry/${string}`;
} = {}): OnboardingConfig => ({
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'To enable agent monitoring, you need to install the Sentry SDK with a minimum version of [code:10.28.0].',
            {
              code: <code />,
            }
          ),
        },
        getInstallCodeBlock(params, {
          packageName,
        }),
      ],
    },
  ],
  configure: params => {
    const selected =
      (params.platformOptions as any)?.integration ?? AgentIntegration.VERCEL_AI;

    if (selected === AgentIntegration.MANUAL) {
      return [
        {
          title: t('Configure'),
          content: [
            {
              type: 'text',
              text: t(
                'Initialize the Sentry SDK in the entry point of your application.'
              ),
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
        tracesSampleRate: 1.0,
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

    const isNodeOrMetaPlatform =
      params.platformKey.startsWith('node') ||
      javascriptMetaFrameworks.includes(params.platformKey);

    const vercelAiExtraInstrumentation: ContentBlock[] = [
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
    ];

    const nonManualContent: ContentBlock[] = [
      {
        type: 'text',
        text: isNodeOrMetaPlatform
          ? tct(
              'Import and initialize the Sentry SDK - the [integration] will be enabled automatically:',
              {
                integration:
                  AGENT_INTEGRATION_LABELS[selected as AgentIntegration] ?? selected,
              }
            )
          : t('Import and initialize the Sentry SDK:'),
      },
      {
        type: 'code',
        tabs: [
          {
            label: configFileName ? configFileName : 'JavaScript',
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
      ...(selected === AgentIntegration.VERCEL_AI ? vercelAiExtraInstrumentation : []),
    ];

    return [
      {
        title: t('Configure'),
        content: isNodeOrMetaPlatform
          ? nonManualContent
          : [
              ...nonManualContent,
              ...getBrowserAgentMonitoringOnboardingConfiguration({
                integration: selected,
                packageName,
                importMode,
              }),
            ],
      },
    ];
  },
  verify: params => {
    const isNodePlatform =
      params.platformKey.startsWith('node') ||
      javascriptMetaFrameworks.includes(params.platformKey as any);

    const content: ContentBlock[] = [
      {
        type: 'text',
        text: t('Verify that your instrumentation works by simply calling your LLM.'),
      },
    ];

    if (!isNodePlatform) {
      return [
        {
          type: StepType.VERIFY,
          content,
        },
      ];
    }

    const selected =
      (params.platformOptions as any)?.integration ?? AgentIntegration.VERCEL_AI;

    if (selected === AgentIntegration.ANTHROPIC) {
      content.push({
        type: 'code',
        tabs: [
          {
            label: 'JavaScript',
            language: 'javascript',
            code: `
const Anthropic = require("anthropic");
const anthropic = new Anthropic();

const msg = await anthropic.messages.create({
model: "claude-3-5-sonnet",
messages: [{role: "user", content: "Tell me a joke"}],
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
            code: `
const OpenAI = require("openai");
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
            code: `
const GoogleGenAI = require("@google/genai").GoogleGenAI;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({apiKey: GEMINI_API_KEY});
const response = await ai.models.generateContent({
  model: 'gemini-2.0-flash-001',
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
            code: `
const { ChatOpenAI } = require("@langchain/openai");
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
            code: `
const { ChatOpenAI } = require("@langchain/openai");
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

    return [
      {
        type: StepType.VERIFY,
        content,
      },
    ];
  },
});

export const getNodeMcpOnboarding = ({
  packageName = '@sentry/node',
}: {
  packageName?: `@sentry/${string}`;
} = {}): OnboardingConfig => ({
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'To enable MCP monitoring, you need to install the Sentry SDK with a minimum version of [code:9.44.0].',
            {
              code: <code />,
            }
          ),
        },
        getInstallCodeBlock(params, {
          packageName,
        }),
      ],
    },
  ],
  configure: params => {
    const mcpSdkStep: ContentBlock[] = [
      {
        type: 'text',
        text: tct('Initialize the Sentry SDK by calling [code:Sentry.init()]:', {
          code: <code />,
        }),
      },
      {
        type: 'code',
        tabs: [
          {
            label: 'JavaScript',
            language: 'javascript',
            code: `${getImport(packageName).join('\n')}

Sentry.init({
  dsn: "${params.dsn.public}",
  // Tracing must be enabled for MCP monitoring to work
  tracesSampleRate: 1.0,
  sendDefaultPii: true,
});`,
          },
        ],
      },
      {
        type: 'text',
        text: tct(
          'Wrap your MCP server in a [code:Sentry.wrapMcpServerWithSentry()] call. This will automatically capture spans for all MCP server interactions.',
          {
            code: <code />,
          }
        ),
      },
      {
        type: 'code',
        tabs: [
          {
            label: 'JavaScript',
            language: 'javascript',
            code: `
const { McpServer } = require("@modelcontextprotocol/sdk");

const server = Sentry.wrapMcpServerWithSentry(new McpServer({
    name: "my-mcp-server",
    version: "1.0.0",
}));`,
          },
        ],
      },
    ];

    const manualStep: ContentBlock[] = [
      {
        type: 'text',
        text: t('Initialize the Sentry SDK in the entry point of your application:'),
      },
      {
        type: 'code',
        tabs: [
          {
            label: 'JavaScript',
            language: 'javascript',
            code: `${getImport(packageName).join('\n')}

Sentry.init({
  dsn: "${params.dsn.public}",
  tracesSampleRate: 1.0,
});`,
          },
        ],
      },
      {
        type: 'text',
        text: tct(
          'Then follow the [link:manual instrumentation guide] to instrument your MCP server.',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/node/tracing/instrumentation/custom-instrumentation/mcp-module/#manual-instrumentation" />
            ),
          }
        ),
      },
    ];

    const selected = (params.platformOptions as any)?.integration ?? 'mcp_sdk';
    const content = selected === 'manual' ? manualStep : mcpSdkStep;

    return [
      {
        type: StepType.CONFIGURE,
        content,
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
            'Verify that MCP monitoring is working correctly by triggering some MCP server interactions in your application.'
          ),
        },
      ],
    },
  ],
});

function getNodeLogsConfigureSnippet(
  params: DocsParams,
  packageName: `@sentry/${string}`
): ContentBlock {
  return {
    type: 'code',
    language: 'javascript',
    code: `
import * as Sentry from "${packageName}";

Sentry.init({
  dsn: "${params.dsn.public}",
  integrations: [
  // send console.log, console.warn, and console.error calls as logs to Sentry
  Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
  ],
  // Enable logs to be sent to Sentry
  enableLogs: true,
});`,
  };
}

export const getNodeLogsOnboarding = <
  PlatformOptions extends BasePlatformOptions = BasePlatformOptions,
>({
  docsPlatform,
  packageName,
  generateConfigureSnippet = getNodeLogsConfigureSnippet,
}: {
  docsPlatform: string;
  packageName: `@sentry/${string}`;
  generateConfigureSnippet?: typeof getNodeLogsConfigureSnippet;
}): OnboardingConfig<PlatformOptions> => ({
  install: (params: DocsParams) => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Add the Sentry SDK as a dependency. The minimum version of [packageName] that supports logs is [code:9.41.0].',
            {
              code: <code />,
              packageName: <code>{packageName}</code>,
            }
          ),
        },
        getInstallCodeBlock(params, {packageName}),
        {
          type: 'text',
          text: tct(
            'If you are on an older version of the SDK, follow our [link:migration guide] to upgrade.',
            {
              link: (
                <ExternalLink
                  href={`https://docs.sentry.io/platforms/javascript/guides/${docsPlatform}/migration/`}
                />
              ),
            }
          ),
        },
      ],
    },
  ],
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Enable Sentry logs by adding [code:enableLogs: true] to your [code:Sentry.init()] configuration.',
            {code: <code />}
          ),
        },
        generateConfigureSnippet(params, packageName),
        {
          type: 'text',
          text: tct('For more detailed information, see the [link:logs documentation].', {
            link: (
              <ExternalLink
                href={`https://docs.sentry.io/platforms/javascript/guides/${docsPlatform}/logs/`}
              />
            ),
          }),
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
          text: t('Send a test log from your app to verify logs are arriving in Sentry.'),
        },
        {
          type: 'code',
          language: 'javascript',
          code: `import * as Sentry from "${packageName}";

Sentry.logger.info('User triggered test log', { action: 'test_log' })`,
        },
      ],
    },
  ],
});

/**
 *  Returns the init() with the necessary imports. It is possible to omit the imports.
 */
export const getSdkInitSnippet = (
  params: DocsParams,
  sdkImport: 'node' | 'aws' | 'gpc' | 'nestjs' | null,
  defaultMode?: 'esm' | 'cjs'
) => `${getDefaultNodeImports({params, sdkImport, defaultMode})}

Sentry.init({
  dsn: "${params.dsn.public}",${
    params.isProfilingSelected
      ? `integrations: [
    nodeProfilingIntegration(),
  ],`
      : ''
  }${
    params.isLogsSelected
      ? `

  // Send structured logs to Sentry
  enableLogs: true,`
      : ''
  }${
    params.isPerformanceSelected
      ? `
      // Tracing
      tracesSampleRate: 1.0, //  Capture 100% of the transactions`
      : ''
  }${
    params.isProfilingSelected &&
    params.profilingOptions?.defaultProfilingMode !== 'continuous'
      ? `
    // Set sampling rate for profiling - this is evaluated only once per SDK.init call
    profilesSampleRate: 1.0,`
      : ''
  }${
    params.isProfilingSelected &&
    params.profilingOptions?.defaultProfilingMode === 'continuous'
      ? `
    // Set sampling rate for profiling - this is evaluated only once per SDK.init call
    profileSessionSampleRate: 1.0,
    // Trace lifecycle automatically enables profiling during active traces
    profileLifecycle: 'trace',`
      : ''
  }
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
  });${
    params.isProfilingSelected &&
    params.profilingOptions?.defaultProfilingMode === 'continuous'
      ? `

// Profiling happens automatically after setting it up with \`Sentry.init()\`.
// All spans (unless those discarded by sampling) will have profiling data attached to them.
Sentry.startSpan({
  name: "My Span",
}, () => {
  // The code executed here will be profiled
});`
      : ''
  }`;

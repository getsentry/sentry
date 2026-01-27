import {ExternalLink} from 'sentry/components/core/link';
import type {
  BasePlatformOptions,
  ContentBlock,
  DocsParams,
  OnboardingConfig,
  OnboardingStep,
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

/**
 * Returns the install step for agent monitoring with the minimum SDK version requirement.
 */
export function getAgentMonitoringInstallStep(
  params: DocsParams,
  {
    packageName = '@sentry/node',
    minVersion = '10.28.0',
  }: {
    minVersion?: string;
    packageName?: `@sentry/${string}`;
  } = {}
): OnboardingStep[] {
  const selected =
    (params.platformOptions as any)?.integration ?? AgentIntegration.VERCEL_AI;

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

export function getAgentMonitoringManualConfigStep(
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

export function getImport(
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

function getAgentMonitoringConfigStep({
  params,
  integration,
  packageName,
  importMode,
  configFileName,
}: {
  integration: AgentIntegration;
  packageName: `@sentry/${string}`;
  params: DocsParams;
  configFileName?: string;
  importMode?: 'esm' | 'cjs' | 'esm-only';
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
              ...vercelAiExtraInstrumentation,
            ],
    },
  ];
}

function getAgentMonitoringVerifyStep(params: DocsParams): OnboardingStep[] {
  const content: ContentBlock[] = [
    {
      type: 'text',
      text: t('Verify that your instrumentation works by simply calling your LLM.'),
    },
  ];

  const selected =
    (params.platformOptions as any)?.integration ?? AgentIntegration.VERCEL_AI;

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

export const getNodeAgentMonitoringOnboarding = ({
  packageName = '@sentry/node',
  configFileName,
  importMode,
}: {
  configFileName?: string;
  importMode?: 'esm' | 'cjs' | 'esm-only';
  packageName?: `@sentry/${string}`;
} = {}): OnboardingConfig => ({
  install: params =>
    getAgentMonitoringInstallStep(params, {
      packageName,
    }),
  configure: params => {
    const selected =
      (params.platformOptions as any)?.integration ?? AgentIntegration.VERCEL_AI;

    if (selected === AgentIntegration.MANUAL) {
      return getAgentMonitoringManualConfigStep(params, {
        packageName,
        importMode,
      });
    }

    return getAgentMonitoringConfigStep({
      params,
      integration: selected,
      packageName,
      importMode,
      configFileName,
    });
  },
  verify: getAgentMonitoringVerifyStep,
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

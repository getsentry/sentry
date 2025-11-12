import {ExternalLink} from 'sentry/components/core/link';
import type {
  BasePlatformOptions,
  ContentBlock,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

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
  defaultMode?: 'esm' | 'cjs'
): string[] {
  return defaultMode === 'esm'
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

export const getNodeAgentMonitoringOnboarding = ({
  packageName = '@sentry/node',
  configFileName,
}: {
  configFileName?: string;
  packageName?: `@sentry/${string}`;
} = {}): OnboardingConfig => ({
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'To enable agent monitoring, you need to install the Sentry SDK with a minimum version of [code:10.14.0].',
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
    const vercelContent: ContentBlock[] = [
      {
        type: 'text',
        text: tct(
          'Add the [code:vercelAIIntegration] to your [code:Sentry.init()] call. This integration automatically instruments the [link:Vercel AI SDK] to capture spans for AI operations.',
          {
            code: <code />,
            link: (
              <ExternalLink href="https://docs.sentry.io/product/insights/agents/getting-started/#quick-start-with-vercel-ai-sdk" />
            ),
          }
        ),
      },
      {
        type: 'code',
        tabs: [
          {
            label: configFileName ? configFileName : 'JavaScript',
            language: 'javascript',
            code: `${getImport(packageName).join('\n')}

Sentry.init({
  dsn: "${params.dsn.public}",
  integrations: [
    // Add the Vercel AI SDK integration ${configFileName ? `to ${configFileName}` : ''}
    Sentry.vercelAIIntegration({
      recordInputs: true,
      recordOutputs: true,
    }),
  ],
  // Tracing must be enabled for agent monitoring to work
  tracesSampleRate: 1.0,
  sendDefaultPii: true,
});`,
          },
        ],
      },
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

    const anthropicContent: ContentBlock[] = [
      {
        type: 'text',
        text: tct(
          'Add the [code:anthropicAIIntegration] to your [code:Sentry.init()] call. This integration automatically instruments the Anthropic SDK to capture spans for AI operations.',
          {code: <code />}
        ),
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
  integrations: [
    // Add the AnthropicAI integration
    Sentry.anthropicAIIntegration({
      recordInputs: true,
      recordOutputs: true,
    }),
  ],
  // Tracing must be enabled for agent monitoring to work
  tracesSampleRate: 1.0,
  sendDefaultPii: true,
});`,
          },
        ],
      },
    ];

    const googleGenAIContent: ContentBlock[] = [
      {
        type: 'text',
        text: tct(
          'Add the [code:googleGenAIIntegration] to your [code:Sentry.init()] call. This integration automatically instruments the Google Gen AI SDK to capture spans for AI operations.',
          {code: <code />}
        ),
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
  integrations: [
    // Add the Google Gen AI integration
    Sentry.googleGenAIIntegration({
      recordInputs: true,
      recordOutputs: true,
    }),
  ],
  // Tracing must be enabled for agent monitoring to work
  tracesSampleRate: 1.0,
  sendDefaultPii: true,
});`,
          },
        ],
      },
    ];

    const openaiContent: ContentBlock[] = [
      {
        type: 'text',
        text: tct(
          'Add the [code:openAIIntegration] to your [code:Sentry.init()] call. This integration automatically instruments the OpenAI SDK to capture spans for AI operations.',
          {code: <code />}
        ),
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
  integrations: [
    // Add the OpenAI integration
    Sentry.openAIIntegration({
      recordInputs: true,
      recordOutputs: true,
    }),
  ],
  // Tracing must be enabled for agent monitoring to work
  tracesSampleRate: 1.0,
  sendDefaultPii: true,
});`,
          },
        ],
      },
    ];

    const manualContent: ContentBlock[] = [
      {
        type: 'text',
        text: tct(
          'If you are not using a supported SDK integration, you can instrument your AI calls manually. See [link:manual instrumentation docs] for details.',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/node/tracing/instrumentation/ai-agents-module/#manual-instrumentation" />
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
            code: `${getImport(packageName).join('\n')}

// Create a span around your AI call
await Sentry.startSpan({
  op: "gen_ai.chat",
  name: "chat gpt-4o",
  attributes: {
    "gen_ai.operation.name": "chat",
    "gen_ai.request.model": "gpt-4o",
  }
}, async (span) => {
  // Call your AI function here
  // e.g., await generateText(...)

  // Set further span attributes after the AI call
  span.setAttribute("gen_ai.response.text", "<Your model's response>");
});`,
          },
        ],
      },
    ];

    const selected = (params.platformOptions as any)?.integration ?? 'vercel_ai';
    let content: ContentBlock[] = manualContent;
    if (selected === 'vercel_ai') {
      content = vercelContent;
    }
    if (selected === 'anthropic') {
      content = anthropicContent;
    }
    if (selected === 'openai') {
      content = openaiContent;
    }
    if (selected === 'google_genai') {
      content = googleGenAIContent;
    }
    return [
      {
        title: t('Configure'),
        content,
      },
    ];
  },
  verify: params => {
    const selected = (params.platformOptions as any)?.integration ?? 'vercel_ai';
    const content: ContentBlock[] = [
      {
        type: 'text',
        text: t('Verify that your instrumentation works by simply calling your LLM.'),
      },
    ];

    if (selected === 'anthropic') {
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
    if (selected === 'openai') {
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
    if (selected === 'google_genai') {
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
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct('Initialize the Sentry SDK with [code:Sentry.init()] call.', {
            code: <code />,
          }),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              value: 'javascript',
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
              value: 'javascript',
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

export const getNodeMetricsOnboarding = <
  PlatformOptions extends BasePlatformOptions = BasePlatformOptions,
>({
  docsPlatform,
  packageName,
}: {
  docsPlatform: string;
  packageName: `@sentry/${string}`;
}): OnboardingConfig<PlatformOptions> => ({
  install: (params: DocsParams) => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Add the Sentry SDK as a dependency. The minimum version of [packageName] that supports metrics is [code:10.24.0].',
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
            'Metrics are automatically enabled in your [code:Sentry.init()] configuration. You can emit metrics using the [code:Sentry.metrics] API.',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: `
const Sentry = require("${packageName}");

Sentry.init({
  dsn: "${params.dsn.public}",
});

// Emit custom metrics
Sentry.metrics.count('button_click', 1);
Sentry.metrics.gauge('page_load_time', 150);
Sentry.metrics.distribution('response_time', 200);
`,
        },
        {
          type: 'text',
          text: tct(
            'For more detailed information, see the [link:metrics documentation].',
            {
              link: (
                <ExternalLink
                  href={`https://docs.sentry.io/platforms/javascript/guides/${docsPlatform}/metrics/`}
                />
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
            'Send a test metric from your app to verify metrics are arriving in Sentry.'
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: `const Sentry = require("${packageName}");

// Emit a test metric
Sentry.metrics.count('test_counter', 1);
Sentry.metrics.gauge('test_gauge', 100);
Sentry.metrics.distribution('test_distribution', 150);
`,
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

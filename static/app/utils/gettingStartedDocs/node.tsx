import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getAIRulesForCodeEditorStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {t, tct} from 'sentry/locale';

function getInstallSnippet({
  params,
  packageManager,
  additionalPackages = [],
  basePackage = '@sentry/node',
}: {
  packageManager: 'npm' | 'yarn' | 'pnpm';
  params: DocsParams;
  additionalPackages?: string[];
  basePackage?: string;
}) {
  let packages = [basePackage];
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

export function getInstallConfig(
  params: DocsParams,
  {
    basePackage = '@sentry/node',
    additionalPackages,
  }: {
    additionalPackages?: string[];
    basePackage?: string;
  } = {}
) {
  return [
    {
      code: [
        {
          label: 'npm',
          value: 'npm',
          language: 'bash',
          code: getInstallSnippet({
            params,
            additionalPackages,
            packageManager: 'npm',
            basePackage,
          }),
        },
        {
          label: 'yarn',
          value: 'yarn',
          language: 'bash',
          code: getInstallSnippet({
            params,
            additionalPackages,
            packageManager: 'yarn',
            basePackage,
          }),
        },
        {
          label: 'pnpm',
          value: 'pnpm',
          language: 'bash',
          code: getInstallSnippet({
            params,
            additionalPackages,
            packageManager: 'pnpm',
            basePackage,
          }),
        },
      ],
    },
  ];
}

function getImport(
  sdkPackage: 'node' | 'google-cloud-serverless' | 'aws-serverless' | 'nestjs',
  defaultMode?: 'esm' | 'cjs'
): string[] {
  return defaultMode === 'esm'
    ? [
        `// Import with \`const Sentry = require("@sentry/${sdkPackage}");\` if you are using CJS`,
        `import * as Sentry from "@sentry/${sdkPackage}"`,
      ]
    : [
        `// Import with \`import * as Sentry from "@sentry/${sdkPackage}"\` if you are using ESM`,
        `const Sentry = require("@sentry/${sdkPackage}");`,
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
  sdkPackage: 'node' | 'google-cloud-serverless' | 'aws-serverless' | 'nestjs',
  defaultMode?: 'esm' | 'cjs'
): string {
  return getImport(sdkPackage, defaultMode).join('\n');
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
  node: 'node',
  aws: 'aws-serverless',
  gpc: 'google-cloud-serverless',
  nestjs: 'nestjs',
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

export const getNodeProfilingOnboarding = ({
  basePackage = '@sentry/node',
  profilingLifecycle = 'trace',
}: {
  basePackage?: string;
  profilingLifecycle?: 'trace' | 'manual';
} = {}): OnboardingConfig => ({
  install: params => [
    {
      type: StepType.INSTALL,
      description: tct(
        'To enable profiling, add [code:@sentry/profiling-node] to your imports.',
        {
          code: <code />,
        }
      ),
      configurations: getInstallConfig(params, {
        basePackage,
      }),
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'Set up the [code:nodeProfilingIntegration] in your [code:Sentry.init()] call.',
        {
          code: <code />,
        }
      ),
      configurations: [
        {
          language: 'javascript',
          code: [
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
          additionalInfo:
            profilingLifecycle === 'trace'
              ? tct(
                  'If you need more fine grained control over which spans are profiled, you can do so by [link:enabling manual lifecycle profiling].',
                  {
                    link: (
                      <ExternalLink
                        href={`https://docs.sentry.io/platforms/javascript/guides/node/profiling/node-profiling/#enabling-manual-lifecycle-profiling`}
                      />
                    ),
                  }
                )
              : '',
        },
        {
          description: tct(
            'For more detailed information on profiling, see the [link:profiling documentation].',
            {
              link: (
                <ExternalLink
                  href={`https://docs.sentry.io/platforms/javascript/guides/node/profiling/node-profiling/`}
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
      description: t(
        'Verify that profiling is working correctly by simply using your application.'
      ),
    },
  ],
});

export const getNodeAgentMonitoringOnboarding = ({
  basePackage = '@sentry/node',
}: {
  basePackage?: string;
} = {}): OnboardingConfig => ({
  install: params => [
    {
      type: StepType.INSTALL,
      description: tct(
        'To enable agent monitoring, you need to install the Sentry SDK with a minimum version of [code:9.30.0].',
        {
          code: <code />,
        }
      ),
      configurations: getInstallConfig(params, {
        basePackage,
      }),
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'Add the [code:vercelAIIntegration] to your [code:Sentry.init()] call. This integration automatically instruments the [link:Vercel AI SDK] to capture spans for AI operations.',
        {
          code: <code />,
          link: (
            <ExternalLink href="https://sdk.vercel.ai/docs" />
          ),
        }
      ),
      configurations: [
        {
          language: 'javascript',
          code: [
            {
              label: 'Javascript',
              value: 'javascript',
              language: 'javascript',
              code: `${getImport(basePackage === '@sentry/node' ? 'node' : basePackage as any).join('\n')}

Sentry.init({
  dsn: "${params.dsn.public}",
  integrations: [
    Sentry.vercelAIIntegration({
      // Records inputs to AI function calls
      recordInputs: true,
      // Records outputs from AI function calls
      recordOutputs: true,
    }),
  ],${
    params.isPerformanceSelected
      ? `
  // Tracing must be enabled for agent monitoring to work
  tracesSampleRate: 1.0,`
      : ''
  }

  // Setting this option to true will send default PII data to Sentry.
  // This includes AI inputs and outputs when recordInputs/recordOutputs are enabled
  sendDefaultPii: true,
});`,
            },
          ],
        },
        {
          description: tct(
            'When using the Vercel AI SDK, provide a [code:functionId] to identify the function that the telemetry data is for:',
            {
              code: <code />,
            }
          ),
          code: [
            {
              label: 'Javascript',
              value: 'javascript',
              language: 'javascript',
              code: `import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await generateText({
  model: openai("gpt-4o"),
  prompt: "Tell me a joke",
  experimental_telemetry: {
    isEnabled: true,
    functionId: "my-awesome-function",
  },
});`,
            },
          ],
        },
      ],
    },
    {
      type: StepType.CONFIGURE,
      description: t('Integration Options'),
      configurations: [
        {
          description: tct(
            'The [code:vercelAIIntegration] supports several options to customize its behavior:',
            {
              code: <code />,
            }
          ),
          code: [
            {
              label: 'Javascript',
              value: 'javascript',
              language: 'javascript',
              code: `Sentry.init({
  integrations: [
    Sentry.vercelAIIntegration({
      // Records inputs to AI function calls (default: true if sendDefaultPii is true)
      recordInputs: true,

      // Records outputs from AI function calls (default: true if sendDefaultPii is true)
      recordOutputs: true,

      // Forces the integration to be active even when the ai module is not detected
      // Useful in edge cases where module detection fails (default: false)
      force: false,
    }),
  ],
});`,
            },
          ],
          additionalInfo: tct(
            'You can also control recording per function call by setting [code:experimental_telemetry] options. For more information, see the [link:Vercel AI integration documentation].',
            {
              code: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/node/configuration/integrations/vercelai/" />
              ),
            }
          ),
        },
      ],
    },
    getAIRulesForCodeEditorStep({
      // AI monitoring specific rules for code editors
      rules: `
These examples show how to instrument AI operations with Sentry's agent monitoring.

# AI Agent Monitoring

Use the Vercel AI SDK integration to automatically instrument AI operations.

## Basic Setup

Enable agent monitoring by adding the vercelAIIntegration to your Sentry initialization:

\`\`\`javascript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "${basePackage === '@sentry/node' ? '___DSN___' : '___DSN___'}",
  integrations: [
    Sentry.vercelAIIntegration({
      recordInputs: true,
      recordOutputs: true,
    }),
  ],
  tracesSampleRate: 1.0,
  sendDefaultPii: true, // Required for recording AI inputs/outputs
});
\`\`\`

## Using AI Models

When making AI calls, provide a functionId to identify the operation:

\`\`\`javascript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

async function generateResponse(prompt) {
  return Sentry.startSpan(
    {
      op: "ai.generate",
      name: "Generate AI Response",
    },
    async () => {
      const result = await generateText({
        model: openai("gpt-4o"),
        prompt: prompt,
        experimental_telemetry: {
          isEnabled: true,
          functionId: "generate-response",
        },
      });

      return result.text;
    }
  );
}
\`\`\`

## Streaming Responses

For streaming AI responses, the integration automatically tracks the stream:

\`\`\`javascript
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

async function streamResponse(messages) {
  const result = await streamText({
    model: anthropic("claude-3-opus-20240229"),
    messages: messages,
    experimental_telemetry: {
      isEnabled: true,
      functionId: "stream-chat-response",
    },
  });

  // Process the stream
  for await (const chunk of result.textStream) {
    console.log(chunk);
  }
}
\`\`\`

## Tool Calling

When using AI models with tool calling, the integration tracks each tool invocation:

\`\`\`javascript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const weatherTool = {
  description: 'Get the weather for a location',
  parameters: z.object({
    location: z.string().describe('The location to get weather for'),
  }),
  execute: async ({ location }) => {
    // Fetch weather data
    return { temperature: 72, condition: 'sunny' };
  },
};

async function callWithTools() {
  const result = await generateText({
    model: openai("gpt-4o"),
    prompt: "What's the weather in San Francisco?",
    tools: { weather: weatherTool },
    experimental_telemetry: {
      isEnabled: true,
      functionId: "weather-assistant",
    },
  });

  return result;
}
\`\`\`

## Error Handling

Always wrap AI operations in try-catch blocks to capture errors:

\`\`\`javascript
async function safeAIOperation() {
  try {
    const result = await generateText({
      model: openai("gpt-4o"),
      prompt: "Complex task that might fail",
      experimental_telemetry: {
        isEnabled: true,
        functionId: "complex-operation",
      },
    });

    return result.text;
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        ai_operation: "complex-operation",
      },
      extra: {
        model: "gpt-4o",
      },
    });
    throw error;
  }
}
\`\`\`

## Privacy Controls

Control what data is sent per operation:

\`\`\`javascript
// Disable recording for sensitive operations
const result = await generateText({
  model: openai("gpt-4o"),
  prompt: sensitivePrompt,
  experimental_telemetry: {
    isEnabled: true,
    functionId: "sensitive-operation",
    recordInputs: false, // Don't record the prompt
    recordOutputs: false, // Don't record the response
  },
});
\`\`\`
`,
    }),
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t(
        'Verify that agent monitoring is working by making a call to an AI model using the Vercel AI SDK.'
      ),
      configurations: [
        {
          language: 'javascript',
          code: `import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

async function testAgentMonitoring() {
  try {
    const result = await generateText({
      model: openai("gpt-4o"),
      prompt: "Hello, AI!",
      experimental_telemetry: {
        isEnabled: true,
        functionId: "test-agent-monitoring",
      },
    });

    console.log(result.text);
  } catch (error) {
    Sentry.captureException(error);
  }
}

// Call the function to test
testAgentMonitoring();`,
        },
      ],
      additionalInfo: t(
        'After running this code, you should see AI-related spans in your Sentry dashboard under the Performance section.'
      ),
    },
  ],
});

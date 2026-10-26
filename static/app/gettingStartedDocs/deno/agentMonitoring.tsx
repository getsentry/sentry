import {ExternalLink} from '@sentry/scraps/link';

import type {
  ContentBlock,
  DocsParams,
  OnboardingConfig,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {onboarding as piFrameworkOnboarding} from 'sentry/gettingStartedDocs/node-pi-durable/onboarding';
import {
  getAgentIntegration,
  getManualConfigureStep,
  getMinRequiredVersion,
} from 'sentry/gettingStartedDocs/node/agentMonitoring';
import {t, tct} from 'sentry/locale';
import {SdkUpdateAlert} from 'sentry/views/insights/pages/agents/components/sdkUpdateAlert';
import {ManualInstrumentationNote} from 'sentry/views/insights/pages/agents/llmOnboardingInstructions';
import {
  AGENT_INTEGRATION_LABELS,
  AgentIntegration,
} from 'sentry/views/insights/pages/agents/utils/agentIntegrations';

const PACKAGE_NAME = '@sentry/deno';
const MIN_VERSION = '10.61.0';
// The Deno SDK auto-instruments these SDKs through its import hook from 11.0.0.
const AUTO_INSTRUMENTED_MIN_VERSION = '11.0.0';

const sentryImport = `import * as Sentry from "npm:${PACKAGE_NAME}";`;
const MANUAL_INSTRUMENTATION_DOCS =
  'https://docs.sentry.io/platforms/javascript/guides/deno/agent-tracing/manual-instrumentation/';

/**
 * Example calls for the SDKs the import hook instruments. Each snippet uses
 * `npm:` specifiers so it runs as-is on Deno.
 */
const AUTO_INSTRUMENTED_VERIFY_SNIPPETS: Partial<Record<AgentIntegration, string>> = {
  [AgentIntegration.ANTHROPIC]: `import Anthropic from "npm:@anthropic-ai/sdk";

const client = new Anthropic();

const msg = await client.messages.create({
  max_tokens: 1024,
  messages: [{ role: "user", content: "Tell me a joke" }],
  model: "claude-sonnet-4-6",
});`,
  [AgentIntegration.GOOGLE_GENAI]: `import { GoogleGenAI } from "npm:@google/genai";

const ai = new GoogleGenAI({ apiKey: Deno.env.get("GEMINI_API_KEY") });

const response = await ai.models.generateContent({
  model: "gemini-3-flash-preview",
  contents: "Why is the sky blue?",
});`,
  [AgentIntegration.LANGCHAIN]: `import { ChatOpenAI } from "npm:@langchain/openai";
import { HumanMessage, SystemMessage } from "npm:@langchain/core/messages";

const chatModel = new ChatOpenAI({ model: "gpt-5.4" });

const response = await chatModel.invoke([
  new SystemMessage("You are a helpful assistant."),
  new HumanMessage("Tell me a joke"),
]);`,
  [AgentIntegration.LANGGRAPH]: `import { createReactAgent } from "npm:@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "npm:@langchain/openai";

// Setting the agent name helps Sentry identify and group agent activity
const agent = createReactAgent({
  llm: new ChatOpenAI({ model: "gpt-5.4" }),
  tools: [],
  name: "joke_agent",
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "Tell me a joke" }],
});`,
  [AgentIntegration.OPENAI]: `import OpenAI from "npm:openai";

const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-5.4",
  input: "Tell me a joke",
});`,
};

function isAutoInstrumented(integration: AgentIntegration): boolean {
  return integration in AUTO_INSTRUMENTED_VERIFY_SNIPPETS;
}

function getInstallMinVersion(params: DocsParams): string {
  return isAutoInstrumented(getAgentIntegration(params))
    ? AUTO_INSTRUMENTED_MIN_VERSION
    : getMinRequiredVersion(params, MIN_VERSION);
}

function getAutoInstrumentedConfigureContent(
  params: DocsParams,
  integration: AgentIntegration
): ContentBlock[] {
  return [
    {
      type: 'text',
      text: tct(
        'Initialize the Sentry SDK at the top of your entry file. The [integration] integration is enabled by default:',
        {integration: AGENT_INTEGRATION_LABELS[integration]}
      ),
    },
    {
      type: 'code',
      tabs: [
        {
          label: 'TypeScript',
          language: 'typescript',
          filename: 'app.ts',
          code: `${sentryImport}

Sentry.init({
  dsn: "${params.dsn.public}",
  // Tracing must be enabled for agent monitoring to work
  tracesSampleRate: 1.0,
});`,
        },
      ],
    },
    {
      type: 'text',
      text: tct(
        'The Sentry import hook reads your dependencies from a local [code:node_modules] directory, so set [code:nodeModulesDir] in your [code:deno.json]:',
        {code: <code />}
      ),
    },
    {
      type: 'code',
      tabs: [
        {
          label: 'JSON',
          language: 'json',
          filename: 'deno.json',
          code: `{
  "nodeModulesDir": "auto"
}`,
        },
      ],
    },
    {
      type: 'text',
      text: tct(
        'Preload the import hook with Deno’s [code:--preload] flag so the SDK can instrument [integration] when it loads. Add the hosts your app calls, such as your model provider, to [code:--allow-net], separated by commas:',
        {code: <code />, integration: AGENT_INTEGRATION_LABELS[integration]}
      ),
    },
    {
      type: 'code',
      tabs: [
        {
          label: 'bash',
          language: 'bash',
          code: `deno run \\
  --allow-net=${new URL(params.dsn.public).host} \\
  --allow-env \\
  --allow-read=. \\
  --allow-sys=hostname,osRelease \\
  --preload=npm:${PACKAGE_NAME}/import \\
  app.ts`,
        },
      ],
    },
    {
      type: 'custom',
      content: (
        <ManualInstrumentationNote
          docsLink={<ExternalLink href={MANUAL_INSTRUMENTATION_DOCS} />}
        />
      ),
    },
  ];
}

// The data collection step is appended once around these branches, so none can
// miss or repeat it.
function configureSteps(params: DocsParams): OnboardingStep[] {
  const selected = getAgentIntegration(params);

  if (selected === AgentIntegration.MANUAL) {
    return getManualConfigureStep(params, {
      sentryImport,
      docUrl: MANUAL_INSTRUMENTATION_DOCS,
    });
  }

  if (selected === AgentIntegration.PI) {
    return piFrameworkOnboarding.configure(params);
  }

  if (isAutoInstrumented(selected)) {
    return [
      {
        title: t('Configure'),
        content: getAutoInstrumentedConfigureContent(params, selected),
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
            'Import and initialize the Sentry SDK. The [integration] integration is enabled by default:',
            {
              integration: 'Vercel AI SDK',
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: `${sentryImport}

Sentry.init({
dsn: "${params.dsn.public}",
// Tracing must be enabled for agent monitoring to work
tracesSampleRate: 1.0,
});`,
            },
          ],
        },
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
              code: `import { generateText } from "npm:ai";
import { openai } from "npm:@ai-sdk/openai";

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
            {
              label: 'ToolLoopAgent',
              language: 'javascript',
              code: `import { ToolLoopAgent, tool } from "npm:ai";
import { z } from "npm:zod";

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
        {
          type: 'custom',
          content: (
            <ManualInstrumentationNote
              docsLink={<ExternalLink href={MANUAL_INSTRUMENTATION_DOCS} />}
            />
          ),
        },
      ],
    },
  ];
}

export const agentMonitoring: OnboardingConfig = {
  introduction: params => (
    <SdkUpdateAlert
      projectId={params.project.id}
      minVersion={getInstallMinVersion(params)}
      packageName={PACKAGE_NAME}
    />
  ),
  install: params => {
    if (getAgentIntegration(params) === AgentIntegration.PI) {
      return piFrameworkOnboarding.install(params);
    }

    return [
      {
        type: StepType.INSTALL,
        content: [
          {
            type: 'text',
            text: tct(
              'To enable agent monitoring, you need the Sentry SDK with a minimum version of [minVersion].',
              {
                minVersion: <code>{getInstallMinVersion(params)}</code>,
              }
            ),
          },
          {
            type: 'code',
            tabs: [
              {
                label: 'JavaScript',
                language: 'javascript',
                code: sentryImport,
              },
            ],
          },
        ],
      },
    ];
  },
  configure: configureSteps,
  verify: params => {
    const selected = getAgentIntegration(params);

    if (selected === AgentIntegration.PI) {
      return piFrameworkOnboarding.verify(params);
    }

    const verifySnippet = AUTO_INSTRUMENTED_VERIFY_SNIPPETS[selected];

    return [
      {
        type: StepType.VERIFY,
        content: [
          {
            type: 'text',
            text: t('Verify that your instrumentation works by simply calling your LLM.'),
          },
          ...(verifySnippet
            ? [
                {
                  type: 'code' as const,
                  tabs: [
                    {
                      label: 'TypeScript',
                      language: 'typescript',
                      code: verifySnippet,
                    },
                  ],
                },
              ]
            : []),
        ],
      },
    ];
  },
};

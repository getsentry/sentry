import {ExternalLink} from '@sentry/scraps/link';

import type {
  ContentBlock,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {javascriptMetaFrameworks} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {
  getAgentIntegration,
  getInstallStep,
  getManualConfigureStep,
  mastraOnboarding,
  MIN_REQUIRED_VERSION,
  agentMonitoring as nodeAgentMonitoring,
} from 'sentry/gettingStartedDocs/node/agentMonitoring';
import {getImport} from 'sentry/gettingStartedDocs/node/utils';
import {t, tct} from 'sentry/locale';
import {SdkUpdateAlert} from 'sentry/views/insights/pages/agents/components/sdkUpdateAlert';
import {AgentIntegration} from 'sentry/views/insights/pages/agents/utils/agentIntegrations';

// Meta-frameworks currently have a technical limitation: our server-side integrations do not work,
// even when added manually. Users must use Sentry’s helper functions or manually instrument their
// code, for example with `Sentry.startSpan`.
function getMetaFrameworkAlert({
  params,
  functionName,
}: {
  functionName: string;
  params: DocsParams;
}): ContentBlock[] {
  const isMetaFramework = javascriptMetaFrameworks.includes(params.platformKey);

  if (!isMetaFramework) {
    return [];
  }
  return [
    {
      type: 'alert',
      alertType: 'info',
      text: tct(
        'For [platformName] applications using all runtimes, you need to manually wrap your client instance with [functionName]. See instructions below.',
        {
          platformName:
            platforms.find(p => p.id === params.platformKey)?.name ?? params.platformKey,
          functionName: <code>{functionName}</code>,
        }
      ),
    },
  ];
}

function getClientSideConfig({
  integration,
  params,
  sentryImport,
  configFileName,
}: {
  integration: AgentIntegration;
  params: DocsParams;
  sentryImport: string;
  configFileName?: string;
}): ContentBlock[] {
  const initConfig: ContentBlock[] = [
    {
      type: 'text',
      text: t('Import and initialize the Sentry SDK:'),
    },
    {
      type: 'code',
      tabs: [
        {
          label: configFileName ?? 'JavaScript',
          language: 'javascript',
          code: `${sentryImport}

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
  ];

  if (integration === AgentIntegration.LANGGRAPH) {
    return [
      ...getMetaFrameworkAlert({
        params,
        functionName: 'instrumentLangGraph',
      }),
      ...initConfig,
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
            code: `${sentryImport}
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const llm = new ChatOpenAI({
  modelName: "gpt-4o",
  // WARNING: Never expose API keys in browser code
  apiKey: "OPENAI_API_KEY",
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
      ...getMetaFrameworkAlert({
        params,
        functionName: 'createLangChainCallbackHandler',
      }),
      ...initConfig,
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
            code: `${sentryImport}
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
  apiKey: "OPENAI_API_KEY",
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
      ...getMetaFrameworkAlert({
        params,
        functionName: 'instrumentGoogleGenAIClient',
      }),
      ...initConfig,
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
            code: `${sentryImport}
import { GoogleGenAI } from "@google/genai";

// WARNING: Never expose API keys in browser code
const genAI = new GoogleGenAI({apiKey: "GEMINI_API_KEY"});

const client = Sentry.instrumentGoogleGenAIClient(genAI, {
  recordInputs: true,
  recordOutputs: true,
});

const response = await client.models.generateContent({
  model: 'gemini-2.5-flash-lite',
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
      ...getMetaFrameworkAlert({
        params,
        functionName: 'instrumentAnthropicAiClient',
      }),
      ...initConfig,
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
            code: `${sentryImport}
import Anthropic from "@anthropic-ai/sdk";

// WARNING: Never expose API keys in browser code
const anthropic = new Anthropic({apiKey: "ANTHROPIC_API_KEY"});

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
      ...getMetaFrameworkAlert({
        params,
        functionName: 'instrumentOpenAiClient',
      }),
      ...initConfig,
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
            code: `${sentryImport}
import OpenAI from "openai";

// WARNING: Never expose API keys in browser code
const openai = new OpenAI({apiKey: "OPENAI_API_KEY"});

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

  return initConfig;
}

/**
 * This function is primarily intended for browser-only instructions.
 * However, due to current technical limitations under investigation,
 * some meta frameworks also rely on it.
 *
 * Since these frameworks support Vercel AI / Mastra options,
 * we return server-side instructions from the Node.js agent
 * monitoring function as well.
 */
export function agentMonitoring({
  packageName = '@sentry/browser',
  clientConfigFileName,
  serverConfigFileName,
  minVersion = MIN_REQUIRED_VERSION,
}: {
  clientConfigFileName?: string;
  minVersion?: string;
  packageName?: `@sentry/${string}`;
  serverConfigFileName?: string;
} = {}): OnboardingConfig {
  return {
    introduction: params => (
      <SdkUpdateAlert projectId={params.project.id} minVersion={minVersion} />
    ),
    install: params =>
      getInstallStep(params, {
        packageName,
        minVersion,
      }),
    configure: params => {
      const selected = getAgentIntegration(params);

      // The Vercel AI SDK (generateText, streamText) is server-side only to prevent API key exposure.
      // Therefore, Node.js instructions is returned for this option.
      // This option is only available in meta frameworks.
      if (selected === AgentIntegration.VERCEL_AI) {
        return nodeAgentMonitoring({
          packageName,
          configFileName: serverConfigFileName,
        }).configure(params);
      }

      const importMode = 'esm-only';

      if (selected === AgentIntegration.MANUAL) {
        return getManualConfigureStep(params, {
          packageName,
          importMode,
          configFileName: clientConfigFileName,
        });
      }

      if (selected === AgentIntegration.MASTRA) {
        return mastraOnboarding.configure(params);
      }

      return [
        {
          title: t('Configure'),
          content: getClientSideConfig({
            integration: selected,
            sentryImport: getImport(packageName, importMode).join('\n'),
            params,
            configFileName: clientConfigFileName,
          }),
        },
      ];
    },
    verify: params => {
      const selected = getAgentIntegration(params);

      // The Vercel AI SDK (generateText, streamText) is server-side only to prevent API key exposure.
      // Therefore, Node.js instructions is returned for this option.
      // This option is only available in meta frameworks.
      if (selected === AgentIntegration.VERCEL_AI) {
        return nodeAgentMonitoring({
          packageName,
          configFileName: serverConfigFileName,
        }).verify(params);
      }

      if (selected === AgentIntegration.MASTRA) {
        return mastraOnboarding.verify(params);
      }

      return [
        {
          type: StepType.VERIFY,
          content: [
            {
              type: 'text',
              text: t(
                'Verify that your instrumentation works by simply calling your LLM.'
              ),
            },
          ],
        },
      ];
    },
  };
}

import {ExternalLink} from '@sentry/scraps/link';

import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getAgentIntegration,
  getManualConfigureStep,
} from 'sentry/gettingStartedDocs/node/agentMonitoring';
import {t, tct} from 'sentry/locale';
import {SdkUpdateAlert} from 'sentry/views/insights/pages/agents/components/sdkUpdateAlert';
import {ManualInstrumentationNote} from 'sentry/views/insights/pages/agents/llmOnboardingInstructions';
import {AgentIntegration} from 'sentry/views/insights/pages/agents/utils/agentIntegrations';

const PACKAGE_NAME = '@sentry/deno';
const MIN_VERSION = '10.45.0';

const sentryImport = `import * as Sentry from "npm:${PACKAGE_NAME}";`;

export const agentMonitoring: OnboardingConfig = {
  introduction: params => (
    <SdkUpdateAlert
      projectId={params.project.id}
      minVersion={MIN_VERSION}
      packageName={PACKAGE_NAME}
    />
  ),
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'To enable agent monitoring, you need the Sentry SDK with a minimum version of [minVersion].',
            {
              minVersion: <code>{MIN_VERSION}</code>,
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
  ],
  configure: params => {
    const selected = getAgentIntegration(params);

    if (selected === AgentIntegration.MANUAL) {
      return getManualConfigureStep(params, {
        sentryImport,
        docUrl:
          'https://docs.sentry.io/platforms/javascript/guides/deno/ai-agent-monitoring/#manual-instrumentation',
      });
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
                docsLink={
                  <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/deno/ai-agent-monitoring/#manual-instrumentation" />
                }
              />
            ),
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
          text: t('Verify that your instrumentation works by simply calling your LLM.'),
        },
      ],
    },
  ],
};

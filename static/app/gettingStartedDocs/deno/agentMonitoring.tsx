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
const IMPORT_SPECIFIER = 'npm:@sentry/deno';
const MIN_VERSION = '10.45.0';

const sentryImport = `import * as Sentry from "${IMPORT_SPECIFIER}";`;

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
                code: `import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

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
          {
            type: 'custom',
            content: (
              <ManualInstrumentationNote
                docsLink={
                  <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/deno/tracing/instrumentation/custom-instrumentation/" />
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

import {ExternalLink} from '@sentry/scraps/link';

import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

const EVE_GUIDE =
  'https://docs.sentry.io/platforms/javascript/guides/node/agent-tracing/eve/';

export const onboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {type: 'text', text: t('Install the Sentry Node SDK in your Eve project:')},
        {
          type: 'code',
          tabs: [
            {
              label: 'npm',
              language: 'bash',
              code: `npm install @sentry/node${params.isProfilingSelected ? ' @sentry/profiling-node' : ''}`,
            },
            {
              label: 'yarn',
              language: 'bash',
              code: `yarn add @sentry/node${params.isProfilingSelected ? ' @sentry/profiling-node' : ''}`,
            },
            {
              label: 'pnpm',
              language: 'bash',
              code: `pnpm add @sentry/node${params.isProfilingSelected ? ' @sentry/profiling-node' : ''}`,
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
            'Create [code:agent/instrumentation/sentry.ts]. Eve auto-discovers this provider and runs it before loading your agent and the AI SDK.',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'TypeScript',
              language: 'typescript',
              filename: 'agent/instrumentation/sentry.ts',
              code: `import * as Sentry from "@sentry/node";${
                params.isProfilingSelected
                  ? '\nimport { nodeProfilingIntegration } from "@sentry/profiling-node";'
                  : ''
              }
import { defineInstrumentation } from "eve/instrumentation";

export default defineInstrumentation(
  Sentry.eveInstrumentation({
    dsn: "${params.dsn.public}",${
      params.isProfilingSelected
        ? `
    integrations: [nodeProfilingIntegration()],`
        : ''
    }${
      params.isPerformanceSelected
        ? `
    tracesSampleRate: 1.0,`
        : ''
    }${
      params.isProfilingSelected
        ? `
    profileSessionSampleRate: 1.0,`
        : ''
    }${
      params.isLogsSelected
        ? `
    enableLogs: true,`
        : ''
    }
  }),
);`,
            },
          ],
        },
        {
          type: 'text',
          text: tct('See the [link:Eve guide] for privacy controls and details.', {
            link: <ExternalLink href={EVE_GUIDE} />,
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
          text: t(
            'Start Eve and send a prompt that calls a tool. The agent run shows up as AI spans in Sentry.'
          ),
        },
      ],
    },
  ],
};

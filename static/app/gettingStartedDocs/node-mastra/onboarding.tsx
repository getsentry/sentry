import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

export const onboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Install the Sentry Node SDK and [code:@mastra/observability]. If you previously used [legacy:@mastra/sentry], remove that exporter because it initializes Sentry itself and conflicts with the built-in integration.',
            {code: <code />, legacy: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'npm',
              language: 'bash',
              code: `npm install @sentry/node${params.isProfilingSelected ? ' @sentry/profiling-node' : ''} @mastra/observability`,
            },
            {
              label: 'yarn',
              language: 'bash',
              code: `yarn add @sentry/node${params.isProfilingSelected ? ' @sentry/profiling-node' : ''} @mastra/observability`,
            },
            {
              label: 'pnpm',
              language: 'bash',
              code: `pnpm add @sentry/node${params.isProfilingSelected ? ' @sentry/profiling-node' : ''} @mastra/observability`,
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
            'Create [code:src/mastra/public/instrument.mjs]. Mastra copies files in [public:public/] next to the compiled server, allowing the Sentry SDK to load before Mastra and the AI SDK.',
            {code: <code />, public: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              filename: 'src/mastra/public/instrument.mjs',
              code: `import * as Sentry from "@sentry/node";${
                params.isProfilingSelected
                  ? '\nimport { nodeProfilingIntegration } from "@sentry/profiling-node";'
                  : ''
              }

Sentry.init({
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
});`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'Preload the instrument file for both development and production with Mastra’s [code:--custom-args] option:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'package.json',
              language: 'json',
              filename: 'package.json',
              code: `{
  "scripts": {
    "dev": "mastra dev --custom-args=\\"--import=./instrument.mjs\\"",
    "start": "mastra start --custom-args=\\"--import=./instrument.mjs\\""
  }
}`,
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
            'Run one of your Mastra agents, then open Agent Tracing in Sentry to verify its model generations, tool calls, token usage, latency, and errors.'
          ),
        },
      ],
    },
  ],
};

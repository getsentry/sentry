import {ExternalLink} from '@sentry/scraps/link';

import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

const NODE_GUIDE = 'https://docs.sentry.io/platforms/javascript/guides/pi-durable/';

export const onboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: t('Install the Sentry Node SDK in your Pi Durable project:'),
        },
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
            'Create [code:instrument.mjs] in your project root. The SDK instruments [package:@earendil-works/pi-durable] automatically, so every Harness opened with [open:Harness.open()] is traced without further changes to your agent code.',
            {code: <code />, package: <code />, open: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              filename: 'instrument.mjs',
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
            'Preload the instrument file with Node’s [code:--import] flag so the Sentry SDK loads before Pi Durable:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'bash',
              language: 'bash',
              code: 'node --import ./instrument.mjs app.mjs',
            },
          ],
        },
        {
          type: 'text',
          text: tct('For more details, see the [link:Pi Durable guide].', {
            link: <ExternalLink href={NODE_GUIDE} />,
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
          text: tct(
            'Submit an input to one of your Pi Durable conversations that calls a tool, then confirm a trace with [code:invoke_agent], [code:chat], and [code:execute_tool] spans shows up in Sentry.',
            {code: <code />}
          ),
        },
      ],
    },
  ],
};

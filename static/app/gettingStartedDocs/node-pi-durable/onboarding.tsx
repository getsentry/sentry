import {ExternalLink} from '@sentry/scraps/link';

import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {DeploymentTarget} from 'sentry/views/insights/pages/agents/utils/agentIntegrations';

// The Pi Durable integration ships in this SDK version.
export const PI_DURABLE_MIN_SDK_VERSION = '11.6.0';

const NODE_GUIDE = 'https://docs.sentry.io/platforms/javascript/guides/pi-durable/';
const CLOUDFLARE_GUIDE =
  'https://docs.sentry.io/platforms/javascript/guides/pi-durable/cloudflare/';
const BUNDLER_GUIDE =
  'https://docs.sentry.io/platforms/javascript/guides/pi-durable/install/bundler/';

function isCloudflare(params: DocsParams) {
  return params.platformOptions?.deploymentTarget === DeploymentTarget.CLOUDFLARE;
}

function getPackages(params: DocsParams) {
  if (isCloudflare(params)) {
    return `@sentry/cloudflare@^${PI_DURABLE_MIN_SDK_VERSION}`;
  }
  return `@sentry/node@^${PI_DURABLE_MIN_SDK_VERSION}${
    params.isProfilingSelected
      ? ` @sentry/profiling-node@^${PI_DURABLE_MIN_SDK_VERSION}`
      : ''
  }`;
}

const getNodeInitSnippet = (params: DocsParams) =>
  `import * as Sentry from "@sentry/node";${
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
});`;

const getCloudflareOptionsSnippet = (params: DocsParams) =>
  `import { defineCloudflareOptions } from "@sentry/cloudflare";

export default defineCloudflareOptions((env: Env) => ({
  dsn: "${params.dsn.public}",${
    params.isPerformanceSelected
      ? `
  tracesSampleRate: 1.0,`
      : ''
  }${
    params.isLogsSelected
      ? `
  enableLogs: true,`
      : ''
  }
}));`;

const CLOUDFLARE_VITE_CONFIG_SNIPPET = `import { cloudflare } from "@cloudflare/vite-plugin";
import { sentryCloudflareVitePlugin } from "@sentry/cloudflare/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [cloudflare(), sentryCloudflareVitePlugin()],
});`;

export const onboarding: OnboardingConfig = {
  install: params => {
    const packages = getPackages(params);

    return [
      {
        type: StepType.INSTALL,
        content: [
          {
            type: 'text',
            text: isCloudflare(params)
              ? tct(
                  'Install the Sentry Cloudflare SDK. The Pi Durable integration requires [code:@sentry/cloudflare] version [minVersion] or later:',
                  {
                    code: <code />,
                    minVersion: <code>{PI_DURABLE_MIN_SDK_VERSION}</code>,
                  }
                )
              : tct(
                  'Install the Sentry Node SDK. The Pi Durable integration requires [code:@sentry/node] version [minVersion] or later:',
                  {
                    code: <code />,
                    minVersion: <code>{PI_DURABLE_MIN_SDK_VERSION}</code>,
                  }
                ),
          },
          {
            type: 'code',
            tabs: [
              {label: 'npm', language: 'bash', code: `npm install ${packages}`},
              {label: 'yarn', language: 'bash', code: `yarn add ${packages}`},
              {label: 'pnpm', language: 'bash', code: `pnpm add ${packages}`},
            ],
          },
        ],
      },
    ];
  },
  configure: params => {
    if (isCloudflare(params)) {
      return [
        {
          title: t('Configure'),
          content: [
            {
              type: 'text',
              text: tct(
                'Add the Sentry Vite plugin to your Vite config. It instruments [code:Harness.open()] at build time and wraps your Worker entry, Durable Object classes, and Agents SDK classes with Sentry, so your Pi Durable code does not change.',
                {code: <code />}
              ),
            },
            {
              type: 'code',
              tabs: [
                {
                  label: 'TypeScript',
                  language: 'typescript',
                  filename: 'vite.config.mts',
                  code: CLOUDFLARE_VITE_CONFIG_SNIPPET,
                },
              ],
            },
            {
              type: 'text',
              text: tct(
                "Create an [code:instrument.server.ts] file next to your Worker entry (the file named in Wrangler's [code:main]). The plugin picks it up by convention and uses its default export as the Sentry options:",
                {code: <code />}
              ),
            },
            {
              type: 'code',
              tabs: [
                {
                  label: 'TypeScript',
                  language: 'typescript',
                  filename: 'src/instrument.server.ts',
                  code: getCloudflareOptionsSnippet(params),
                },
              ],
            },
            {
              type: 'text',
              text: t(
                'Enable Node.js compatibility in your Wrangler config so the SDK can run on Workers:'
              ),
            },
            {
              type: 'code',
              tabs: [
                {
                  label: 'TOML',
                  language: 'toml',
                  filename: 'wrangler.toml',
                  code: `main = "src/index.ts"
compatibility_flags = ["nodejs_compat"]`,
                },
              ],
            },
            {
              type: 'text',
              text: tct(
                'For more details, see the [link:Pi Durable on Cloudflare guide].',
                {
                  link: <ExternalLink href={CLOUDFLARE_GUIDE} />,
                }
              ),
            },
          ],
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
              "Create an [code:instrument.mjs] file that calls [code:Sentry.init()]. The Pi Durable integration is enabled by default, so you don't need to add it to [code:integrations]:",
              {code: <code />}
            ),
          },
          {
            type: 'code',
            tabs: [
              {
                label: 'JavaScript',
                language: 'javascript',
                filename: 'instrument.mjs',
                code: getNodeInitSnippet(params),
              },
            ],
          },
          {
            type: 'text',
            text: tct(
              'Preload the instrument file with the [code:--import] flag. The SDK instruments [code:Harness.open()] while Node.js loads [code:@earendil-works/pi-durable], so Sentry has to start before your app imports it:',
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
    "start": "node --import ./instrument.mjs server.mjs"
  }
}`,
              },
            ],
          },
          {
            type: 'text',
            text: tct(
              "Your Pi Durable code doesn't change: every Harness your app opens is traced. If you bundle your server and can't pass [code:--import], use the [bundlerLink:bundler plugin]. Running Pi Durable in a Cloudflare Durable Object? Follow the [cloudflareLink:Cloudflare guide] instead.",
              {
                code: <code />,
                bundlerLink: <ExternalLink href={BUNDLER_GUIDE} />,
                cloudflareLink: <ExternalLink href={CLOUDFLARE_GUIDE} />,
              }
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
          text: tct(
            'Submit a message to one of your Pi Durable conversations, ideally one that calls a tool. The agent run, model requests, tool calls, token usage, and any errors your tools throw show up as [code:invoke_agent], [code:chat], and [code:execute_tool] spans in Sentry.',
            {code: <code />}
          ),
        },
        {
          type: 'text',
          text: tct('See the [link:Pi Durable guide] for privacy controls and details.', {
            link: <ExternalLink href={NODE_GUIDE} />,
          }),
        },
      ],
    },
  ],
};

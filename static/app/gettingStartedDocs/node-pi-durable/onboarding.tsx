import {ExternalLink} from '@sentry/scraps/link';

import type {
  ContentBlock,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getCompatibilityDate} from 'sentry/gettingStartedDocs/node-cloudflare-workers/utils';
import {t, tct} from 'sentry/locale';
import {
  DeploymentTarget,
  getPlatformDeploymentTarget,
  getSdkImportSpecifier,
} from 'sentry/views/insights/pages/agents/utils/agentIntegrations';

const NODE_GUIDE = 'https://docs.sentry.io/platforms/javascript/guides/pi-durable/';
const CLOUDFLARE_GUIDE =
  'https://docs.sentry.io/platforms/javascript/guides/pi-durable/cloudflare/';

/**
 * The runtimes the Sentry SDK instruments Pi Durable on. Each one needs the
 * code transform that injects the diagnostics channel into `Harness.open()`:
 * a runtime hook on Node and Deno, a bundler plugin on Bun and Cloudflare.
 */
enum PiDurableRuntime {
  NODE = 'node',
  BUN = 'bun',
  DENO = 'deno',
  CLOUDFLARE = 'cloudflare',
}

function getRuntime(params: DocsParams): PiDurableRuntime {
  // Pi Durable projects pick any runtime; Deno, Bun and Cloudflare Workers
  // projects are fixed to their platform's runtime.
  switch (
    params.platformOptions?.deploymentTarget ??
    getPlatformDeploymentTarget(params.platformKey)
  ) {
    case DeploymentTarget.CLOUDFLARE:
      return PiDurableRuntime.CLOUDFLARE;
    case DeploymentTarget.BUN:
      return PiDurableRuntime.BUN;
    case DeploymentTarget.DENO:
      return PiDurableRuntime.DENO;
    default:
      return PiDurableRuntime.NODE;
  }
}

const RUNTIME_PACKAGE_NAMES: Record<PiDurableRuntime, `@sentry/${string}`> = {
  [PiDurableRuntime.NODE]: '@sentry/node',
  [PiDurableRuntime.BUN]: '@sentry/bun',
  [PiDurableRuntime.DENO]: '@sentry/deno',
  [PiDurableRuntime.CLOUDFLARE]: '@sentry/cloudflare',
};

function getInitOptions(params: DocsParams): string {
  return `dsn: "${params.dsn.public}",${
    params.isPerformanceSelected
      ? `
  tracesSampleRate: 1.0,`
      : ''
  }${
    params.isLogsSelected
      ? `
  enableLogs: true,`
      : ''
  }`;
}

function getAutoInstrumentationText(): React.ReactNode {
  return tct(
    'The Pi Durable integration is enabled by default, so every Harness opened with [code:Harness.open()] is traced without further changes to your agent code.',
    {code: <code />}
  );
}

function getPackageManagerTabs(packageName: string, extraPackages = '') {
  return [
    {label: 'npm', language: 'bash', code: `npm install ${packageName}${extraPackages}`},
    {label: 'yarn', language: 'bash', code: `yarn add ${packageName}${extraPackages}`},
    {label: 'pnpm', language: 'bash', code: `pnpm add ${packageName}${extraPackages}`},
  ];
}

function getInstallContent(params: DocsParams): ContentBlock[] {
  switch (getRuntime(params)) {
    case PiDurableRuntime.CLOUDFLARE:
      return [
        {type: 'text', text: t('Install the Sentry Cloudflare SDK in your Worker:')},
        {type: 'code', tabs: getPackageManagerTabs('@sentry/cloudflare')},
      ];
    case PiDurableRuntime.BUN:
      return [
        {type: 'text', text: t('Install the Sentry Bun SDK in your Pi Durable project:')},
        {type: 'code', language: 'bash', code: 'bun add @sentry/bun'},
      ];
    case PiDurableRuntime.DENO:
      return [
        {
          type: 'text',
          text: tct(
            'Deno loads the Sentry Deno SDK from npm through the [code:npm:] specifier, so there is nothing to install. Import it in your entry file:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: 'import * as Sentry from "npm:@sentry/deno";',
        },
      ];
    case PiDurableRuntime.NODE:
    default:
      return [
        {
          type: 'text',
          text: t('Install the Sentry Node SDK in your Pi Durable project:'),
        },
        {
          type: 'code',
          tabs: getPackageManagerTabs(
            '@sentry/node',
            params.isProfilingSelected ? ' @sentry/profiling-node' : ''
          ),
        },
      ];
  }
}

function getNodeConfigureContent(params: DocsParams): ContentBlock[] {
  return [
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
  ];
}

function getBunConfigureContent(params: DocsParams): ContentBlock[] {
  return [
    {
      type: 'text',
      text: tct(
        'Create [code:instrument.ts] in your project root. [autoInstrumentation]',
        {code: <code />, autoInstrumentation: getAutoInstrumentationText()}
      ),
    },
    {
      type: 'code',
      tabs: [
        {
          label: 'TypeScript',
          language: 'typescript',
          filename: 'instrument.ts',
          code: `import * as Sentry from "@sentry/bun";

Sentry.init({
  ${getInitOptions(params)}
});`,
        },
      ],
    },
    {
      type: 'text',
      text: tct(
        'Bun has no runtime hook Sentry can use, so build your app with [code:sentryBunPlugin()]. The plugin instruments [code:Harness.open()] while it bundles [package:@earendil-works/pi-durable]:',
        {code: <code />, package: <code />}
      ),
    },
    {
      type: 'code',
      tabs: [
        {
          label: 'TypeScript',
          language: 'typescript',
          filename: 'build.ts',
          code: `import { sentryBunPlugin } from "@sentry/bun/plugin";

await Bun.build({
  entrypoints: ["./app.ts"],
  outdir: "./dist",
  target: "bun",
  plugins: [sentryBunPlugin()],
});`,
        },
      ],
    },
    {
      type: 'text',
      text: tct(
        'Run the built output with the instrument file preloaded. Running your source directly with [code:bun run] skips the plugin, so Pi Durable is not traced:',
        {code: <code />}
      ),
    },
    {
      type: 'code',
      tabs: [
        {
          label: 'bash',
          language: 'bash',
          code: 'bun build.ts && bun --preload ./instrument.ts dist/app.js',
        },
      ],
    },
  ];
}

function getDenoConfigureContent(params: DocsParams): ContentBlock[] {
  return [
    {
      type: 'text',
      text: tct(
        'Initialize the Sentry SDK at the top of your entry file. [autoInstrumentation]',
        {autoInstrumentation: getAutoInstrumentationText()}
      ),
    },
    {
      type: 'code',
      tabs: [
        {
          label: 'TypeScript',
          language: 'typescript',
          filename: 'app.ts',
          code: `import * as Sentry from "npm:@sentry/deno";

Sentry.init({
  ${getInitOptions(params)}
});`,
        },
      ],
    },
    {
      type: 'text',
      text: tct(
        'Preload the Sentry import hook with Deno’s [code:--preload] flag so the SDK can instrument [package:@earendil-works/pi-durable] when it loads. Deno blocks network, file system, and system access until you grant it, so add the hosts your agents call, such as your model provider, to [code:--allow-net], separated by commas, along with any other access your app needs:',
        {code: <code />, package: <code />}
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
  --preload=npm:@sentry/deno/import \\
  app.ts`,
        },
      ],
    },
  ];
}

function getCloudflareConfigureContent(params: DocsParams): ContentBlock[] {
  return [
    {
      type: 'text',
      text: tct(
        'Add the Sentry Vite plugin to your Vite config. It instruments [code:Harness.open()] at build time and wraps your Worker entry, Durable Object classes, and Agents SDK classes with Sentry, so Pi Durable is traced inside the Durable Object that hosts it:',
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
          code: `import { cloudflare } from "@cloudflare/vite-plugin";
import { sentryCloudflareVitePlugin } from "@sentry/cloudflare/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [cloudflare(), sentryCloudflareVitePlugin()],
});`,
        },
      ],
    },
    {
      type: 'text',
      text: tct(
        'Create [code:instrument.server.ts] next to your Worker entry (the file named in Wrangler’s [code:main]). The plugin picks it up by convention and uses its default export as the Sentry options:',
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
          code: `import { defineCloudflareOptions } from "@sentry/cloudflare";

export default defineCloudflareOptions((env: Env) => ({
  ${getInitOptions(params)}
}));`,
        },
      ],
    },
    {
      type: 'text',
      text: t(
        'Enable Node.js compatibility and set a compatibility date in your Wrangler config:'
      ),
    },
    {
      type: 'code',
      tabs: [
        {
          label: 'TOML',
          language: 'toml',
          filename: 'wrangler.toml',
          code: `compatibility_flags = ["nodejs_compat"]
compatibility_date = "${getCompatibilityDate()}"`,
        },
        {
          label: 'JSON',
          language: 'json',
          filename: 'wrangler.jsonc',
          code: `{
  "compatibility_flags": ["nodejs_compat"],
  "compatibility_date": "${getCompatibilityDate()}"
}`,
        },
      ],
    },
    {
      type: 'text',
      text: tct('For more details, see the [link:Pi Durable on Cloudflare guide].', {
        link: <ExternalLink href={CLOUDFLARE_GUIDE} />,
      }),
    },
  ];
}

function getConfigureContent(params: DocsParams): ContentBlock[] {
  switch (getRuntime(params)) {
    case PiDurableRuntime.CLOUDFLARE:
      return getCloudflareConfigureContent(params);
    case PiDurableRuntime.BUN:
      return getBunConfigureContent(params);
    case PiDurableRuntime.DENO:
      return getDenoConfigureContent(params);
    case PiDurableRuntime.NODE:
    default:
      return getNodeConfigureContent(params);
  }
}

export const onboarding: OnboardingConfig = {
  sdkImportSpecifier: params =>
    getSdkImportSpecifier(RUNTIME_PACKAGE_NAMES[getRuntime(params)]),
  install: params => [
    {
      type: StepType.INSTALL,
      content: getInstallContent(params),
    },
  ],
  configure: params => [
    {
      title: t('Configure'),
      content: getConfigureContent(params),
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

import type {
  ContentBlock,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {getInstallCodeBlock} from 'sentry/gettingStartedDocs/node/utils';
import {t, tct} from 'sentry/locale';

import {Runtime, type Params, type PlatformOptions} from './utils';

const RUNTIME_CONFIG: Record<
  Runtime,
  {importPath: string; label: string; peerDep: `@sentry/${string}`}
> = {
  [Runtime.NODE]: {
    importPath: '@sentry/hono/node',
    peerDep: '@sentry/node',
    label: 'the Node.js runtime',
  },
  [Runtime.CLOUDFLARE]: {
    importPath: '@sentry/hono/cloudflare',
    peerDep: '@sentry/cloudflare',
    label: 'Cloudflare Workers',
  },
  [Runtime.BUN]: {
    importPath: '@sentry/hono/bun',
    peerDep: '@sentry/bun',
    label: 'the Bun runtime',
  },
};

function getNodeInstrumentSnippet(params: Params): string {
  const imports = [
    `import * as Sentry from "${RUNTIME_CONFIG[Runtime.NODE].importPath}";`,
  ];
  if (params.isProfilingSelected) {
    imports.push('import { nodeProfilingIntegration } from "@sentry/profiling-node";');
  }

  return `${imports.join('\n')}

Sentry.init({
  dsn: "${params.dsn.public}",${
    params.isProfilingSelected
      ? `
  integrations: [
    nodeProfilingIntegration(),
  ],`
      : ''
  }${
    params.isPerformanceSelected
      ? `
  tracesSampleRate: 1.0,`
      : ''
  }${
    params.isProfilingSelected &&
    params.profilingOptions?.defaultProfilingMode !== 'continuous'
      ? `
  profilesSampleRate: 1.0,`
      : ''
  }${
    params.isProfilingSelected &&
    params.profilingOptions?.defaultProfilingMode === 'continuous'
      ? `
  profileSessionSampleRate: 1.0,
  profileLifecycle: 'trace',`
      : ''
  }${
    params.isLogsSelected
      ? `
  enableLogs: true,`
      : ''
  }
  // To disable sending user data and HTTP bodies, uncomment the line below. For more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/hono/configuration/options/#dataCollection
  // dataCollection: { userInfo: false, httpBodies: [] },
});`;
}

function getNodeAppSnippet(): string {
  return `import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { sentry } from "${RUNTIME_CONFIG[Runtime.NODE].importPath}";

const app = new Hono();

app.use(sentry(app));

// Your routes here

serve(app);`;
}

/**
 * Generates the app snippet for runtimes that pass Sentry options
 * directly to the middleware (Cloudflare Workers and Bun).
 */
function getInlineInitAppSnippet(runtime: Runtime, params: Params): string {
  return `import { Hono } from "hono";
import { sentry } from "${RUNTIME_CONFIG[runtime].importPath}";

const app = new Hono();

app.use(
  sentry(app, {
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
    // To disable sending user data and HTTP bodies, uncomment the line below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/hono/configuration/options/#dataCollection
    // dataCollection: { userInfo: false, httpBodies: [] },
  }),
);

// Your routes here
app.get("/", (c) => {
  return c.text("Hello Hono!");
});

export default app;`;
}

function getWranglerSnippet(): string {
  return `{
  "compatibility_flags": ["nodejs_compat"]
}`;
}

function getVerifySnippet(params: Params): string {
  const needsSentryImport = params.isLogsSelected || params.isMetricsSelected;
  const importLine = needsSentryImport
    ? `import * as Sentry from "${RUNTIME_CONFIG[params.platformOptions.runtime].importPath}";\n\n`
    : '';

  return `${importLine}app.get("/debug-sentry", () => {${
    params.isLogsSelected
      ? `
  // Send a log before throwing the error
  Sentry.logger.info('User triggered test error', {
    action: 'test_error_endpoint',
  });`
      : ''
  }${
    params.isMetricsSelected
      ? `
  // Send a test metric before throwing the error
  Sentry.metrics.count('test_counter', 1);`
      : ''
  }
  throw new Error("My first Sentry error!");
});`;
}

function getInstallStep(runtime: Runtime, params: Params) {
  const config = RUNTIME_CONFIG[runtime];
  const suppressProfiling = runtime !== Runtime.NODE;

  return {
    type: StepType.INSTALL as const,
    content: [
      {
        type: 'text' as const,
        text: tct(
          'Install the [sentryHono] package and the [peerDep] peer dependency for [label]:',
          {
            sentryHono: <code>@sentry/hono</code>,
            peerDep: <code>{config.peerDep}</code>,
            label: config.label,
          }
        ),
      },
      getInstallCodeBlock(
        suppressProfiling ? {...params, isProfilingSelected: false} : params,
        {
          packageName: '@sentry/hono',
          additionalPackages: [config.peerDep],
        }
      ),
    ],
  };
}

function getProfilingAlert(params: Params): ContentBlock {
  return {
    type: 'conditional',
    condition: params.isProfilingSelected,
    content: [
      {
        type: 'alert',
        alertType: 'info',
        showIcon: true,
        text: t(
          'Profiling is only available on the Node.js runtime. Select the Node.js runtime above to see profiling setup instructions.'
        ),
      },
    ],
  };
}

function getSourceMapsStep(params: Params) {
  return getUploadSourceMapsStep({
    guideLink: 'https://docs.sentry.io/platforms/javascript/guides/hono/sourcemaps/',
    ...params,
  });
}

function getVerifyStep(params: Params) {
  return {
    type: StepType.VERIFY as const,
    content: [
      {
        type: 'text' as const,
        text: t('Add a route that triggers an error to verify Sentry is working:'),
      },
      {
        type: 'code' as const,
        language: 'javascript',
        code: getVerifySnippet(params),
      },
    ],
  };
}

const runtimeOnboarding: Record<Runtime, OnboardingConfig<PlatformOptions>> = {
  [Runtime.NODE]: {
    install: (params: Params) => [getInstallStep(Runtime.NODE, params)],
    configure: (params: Params) => [
      {
        type: StepType.CONFIGURE,
        content: [
          {
            type: 'text',
            text: tct(
              'Node.js requires Sentry to initialize before your application loads. Create a file called [code:instrument.mjs]:',
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
                value: 'javascript',
                code: getNodeInstrumentSnippet(params),
              },
            ],
          },
          {
            type: 'text',
            text: tct(
              'Start your app with the [code:--import] flag to load the instrument file:',
              {code: <code />}
            ),
          },
          {
            type: 'code',
            language: 'bash',
            code: 'node --import ./instrument.mjs app.js',
          },
          {
            type: 'text',
            text: tct(
              'Add the [code:sentry()] middleware as early as possible in your Hono app:',
              {code: <code />}
            ),
          },
          {
            type: 'code',
            tabs: [
              {
                label: 'JavaScript',
                language: 'javascript',
                filename: 'app.js',
                value: 'javascript',
                code: getNodeAppSnippet(),
              },
            ],
          },
        ],
      },
      getSourceMapsStep(params),
    ],
    verify: (params: Params) => [getVerifyStep(params)],
  },
  [Runtime.CLOUDFLARE]: {
    install: (params: Params) => [getInstallStep(Runtime.CLOUDFLARE, params)],
    configure: (params: Params) => [
      {
        type: StepType.CONFIGURE,
        content: [
          getProfilingAlert(params),
          {
            type: 'text',
            text: tct(
              'Enable the [code:nodejs_compat] compatibility flag in your [code:wrangler.jsonc]. The SDK needs [code:AsyncLocalStorage], which requires this flag:',
              {code: <code />}
            ),
          },
          {
            type: 'code',
            tabs: [
              {
                label: 'jsonc',
                language: 'json',
                filename: 'wrangler.jsonc',
                value: 'jsonc',
                code: getWranglerSnippet(),
              },
            ],
          },
          {
            type: 'text',
            text: tct(
              'Add the [code:sentry()] middleware as early as possible in your Hono app. On Cloudflare, you pass your Sentry options directly to the middleware:',
              {code: <code />}
            ),
          },
          {
            type: 'code',
            tabs: [
              {
                label: 'TypeScript',
                language: 'typescript',
                filename: 'index.ts',
                value: 'typescript',
                code: getInlineInitAppSnippet(Runtime.CLOUDFLARE, params),
              },
            ],
          },
          {
            type: 'text',
            text: tct(
              'To access environment variables from Worker Bindings (e.g. to store the DSN as a secret), pass a callback instead: [code:sentry(app, (env) => (\\{ dsn: env.SENTRY_DSN \\}))].',
              {code: <code />}
            ),
          },
        ],
      },
      getSourceMapsStep(params),
    ],
    verify: (params: Params) => [getVerifyStep(params)],
  },
  [Runtime.BUN]: {
    install: (params: Params) => [getInstallStep(Runtime.BUN, params)],
    configure: (params: Params) => [
      {
        type: StepType.CONFIGURE,
        content: [
          getProfilingAlert(params),
          {
            type: 'text',
            text: tct(
              'Add the [code:sentry()] middleware as early as possible in your Hono app. On Bun, you pass your Sentry options directly to the middleware:',
              {code: <code />}
            ),
          },
          {
            type: 'code',
            tabs: [
              {
                label: 'TypeScript',
                language: 'typescript',
                filename: 'index.ts',
                value: 'typescript',
                code: getInlineInitAppSnippet(Runtime.BUN, params),
              },
            ],
          },
        ],
      },
      getSourceMapsStep(params),
    ],
    verify: (params: Params) => [getVerifyStep(params)],
  },
};

export const onboarding: OnboardingConfig<PlatformOptions> = {
  introduction: () =>
    tct(
      'The [code:@sentry/hono] SDK supports Hono 4+ across multiple runtimes. Select your runtime below to see the setup instructions.',
      {code: <code />}
    ),
  install: (params: Params) =>
    runtimeOnboarding[params.platformOptions.runtime].install(params),
  configure: (params: Params) =>
    runtimeOnboarding[params.platformOptions.runtime].configure(params),
  verify: (params: Params) =>
    runtimeOnboarding[params.platformOptions.runtime].verify(params),
  nextSteps: (params: Params) => {
    const steps = [];

    if (params.isLogsSelected) {
      steps.push({
        id: 'logs',
        name: t('Logging Integrations'),
        description: t(
          'Add logging integrations to automatically capture logs from your application.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/hono/logs/#integrations',
      });
    }

    return steps;
  },
};

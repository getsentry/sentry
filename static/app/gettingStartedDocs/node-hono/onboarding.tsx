import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {getInstallCodeBlock} from 'sentry/gettingStartedDocs/node/utils';
import {t, tct} from 'sentry/locale';

import {Runtime, type Params, type PlatformOptions} from './utils';

function getNodeInstrumentSnippet(params: Params): string {
  const imports = [`import * as Sentry from "@sentry/hono/node";`];
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
  sendDefaultPii: true,
});`;
}

function getNodeAppSnippet(): string {
  return `import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { sentry } from "@sentry/hono/node";

const app = new Hono();

app.use(sentry(app));

// Your routes here

serve(app);`;
}

function getBunAppSnippet(params: Params): string {
  return `import { Hono } from "hono";
import { sentry } from "@sentry/hono/bun";

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
    sendDefaultPii: true,
  }),
);

// Your routes here
app.get("/", (c) => {
  return c.text("Hello Hono!");
});

export default app;`;
}

function getCloudflareAppSnippet(params: Params): string {
  return `import { Hono } from "hono";
import { sentry } from "@sentry/hono/cloudflare";

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
    sendDefaultPii: true,
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

const getVerifySnippet = (params: Params) => `app.get("/debug-sentry", () => {${
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

const runtimeOnboarding: Record<Runtime, OnboardingConfig<PlatformOptions>> = {
  [Runtime.NODE]: {
    install: (params: Params) => [
      {
        type: StepType.INSTALL,
        content: [
          {
            type: 'text',
            text: tct(
              'Install the [code:@sentry/hono] package and the [code:@sentry/node] peer dependency for the Node.js runtime:',
              {code: <code />}
            ),
          },
          getInstallCodeBlock(params, {
            packageName: '@sentry/hono',
            additionalPackages: ['@sentry/node'],
          }),
        ],
      },
    ],
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
      getUploadSourceMapsStep({
        guideLink: 'https://docs.sentry.io/platforms/javascript/guides/hono/sourcemaps/',
        ...params,
      }),
    ],
    verify: (params: Params) => [
      {
        type: StepType.VERIFY,
        content: [
          {
            type: 'text',
            text: t('Add a route that triggers an error to verify Sentry is working:'),
          },
          {
            type: 'code',
            language: 'javascript',
            code: getVerifySnippet(params),
          },
        ],
      },
    ],
  },
  [Runtime.CLOUDFLARE]: {
    install: (params: Params) => [
      {
        type: StepType.INSTALL,
        content: [
          {
            type: 'text',
            text: tct(
              'Install the [code:@sentry/hono] package and the [code:@sentry/cloudflare] peer dependency for Cloudflare Workers:',
              {code: <code />}
            ),
          },
          getInstallCodeBlock(
            {...params, isProfilingSelected: false},
            {
              packageName: '@sentry/hono',
              additionalPackages: ['@sentry/cloudflare'],
            }
          ),
        ],
      },
    ],
    configure: (params: Params) => [
      {
        type: StepType.CONFIGURE,
        content: [
          {
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
          },
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
                code: getCloudflareAppSnippet(params),
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
      getUploadSourceMapsStep({
        guideLink: 'https://docs.sentry.io/platforms/javascript/guides/hono/sourcemaps/',
        ...params,
      }),
    ],
    verify: (params: Params) => [
      {
        type: StepType.VERIFY,
        content: [
          {
            type: 'text',
            text: t('Add a route that triggers an error to verify Sentry is working:'),
          },
          {
            type: 'code',
            language: 'javascript',
            code: getVerifySnippet(params),
          },
        ],
      },
    ],
  },
  [Runtime.BUN]: {
    install: (params: Params) => [
      {
        type: StepType.INSTALL,
        content: [
          {
            type: 'text',
            text: tct(
              'Install the [code:@sentry/hono] package and the [code:@sentry/bun] peer dependency for the Bun runtime:',
              {code: <code />}
            ),
          },
          getInstallCodeBlock(
            {...params, isProfilingSelected: false},
            {
              packageName: '@sentry/hono',
              additionalPackages: ['@sentry/bun'],
            }
          ),
        ],
      },
    ],
    configure: (params: Params) => [
      {
        type: StepType.CONFIGURE,
        content: [
          {
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
          },
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
                code: getBunAppSnippet(params),
              },
            ],
          },
        ],
      },
      getUploadSourceMapsStep({
        guideLink: 'https://docs.sentry.io/platforms/javascript/guides/hono/sourcemaps/',
        ...params,
      }),
    ],
    verify: (params: Params) => [
      {
        type: StepType.VERIFY,
        content: [
          {
            type: 'text',
            text: t('Add a route that triggers an error to verify Sentry is working:'),
          },
          {
            type: 'code',
            language: 'javascript',
            code: getVerifySnippet(params),
          },
        ],
      },
    ],
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

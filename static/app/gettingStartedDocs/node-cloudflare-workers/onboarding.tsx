import {ExternalLink} from '@sentry/scraps/link';

import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {getInstallCodeBlock} from 'sentry/gettingStartedDocs/node/utils';
import {t, tct} from 'sentry/locale';

import type {Params, PlatformOptions} from './utils';
import {isPagesSetup, isViteSetup} from './utils';

// The date whose Cloudflare runtime defaults the snippets opt into. Today's date
// gives a new project the newest defaults, and any date from 2024-09-23 on gives
// `nodejs_compat` the full Node.js API surface the SDK needs.
const getCompatibilityDate = () => new Date().toISOString().slice(0, 10);

const getSdkConfigureSnippetToml = () => `
compatibility_flags = ["nodejs_compat"]
compatibility_date = "${getCompatibilityDate()}"
`;

const getSdkConfigureSnippetJson = () => `
{
  "compatibility_flags": [
    "nodejs_compat"
  ],
  "compatibility_date": "${getCompatibilityDate()}"
}`;

const getSdkOptionsSnippet = (params: Params, indent: string) =>
  `${indent}dsn: "${params.dsn.public}",${
    params.isPerformanceSelected
      ? `
${indent}// Set tracesSampleRate to 1.0 to capture 100% of spans for tracing.
${indent}// Learn more at
${indent}// https://docs.sentry.io/platforms/javascript/configuration/options/#traces-sample-rate
${indent}tracesSampleRate: 1.0,`
      : ''
  }

${indent}dataCollection: {
${indent}  // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
${indent}  // https://docs.sentry.io/platforms/javascript/guides/cloudflare/configuration/options/#dataCollection
${indent}  // userInfo: false,
${indent}  // httpBodies: [],
${indent}},`;

const getViteConfigSnippet = () => `
import { cloudflare } from "@cloudflare/vite-plugin";
import { sentryCloudflareVitePlugin } from "@sentry/cloudflare/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [cloudflare(), sentryCloudflareVitePlugin()],
});`;

const getInstrumentFileSnippet = (params: Params) => `
import { defineCloudflareOptions } from "@sentry/cloudflare";

export default defineCloudflareOptions((env) => ({
${getSdkOptionsSnippet(params, '  ')}
}));`;

const getSdkSetupSnippet = (params: Params) => `
import * as Sentry from "@sentry/cloudflare";

export default Sentry.withSentry(
  (env: Env) => ({
${getSdkOptionsSnippet(params, '    ')}
  }),
  {
    async fetch(request, env, ctx) {
      return new Response('Hello World!');
    },
  } satisfies ExportedHandler<Env>,
);`;

const getPagesSetupSnippet = (params: Params) => `
import * as Sentry from "@sentry/cloudflare";

export const onRequest = [
  // Make sure Sentry is the first middleware
  Sentry.sentryPagesPlugin((context) => ({
${getSdkOptionsSnippet(params, '    ')}
  })),
  // Add more middlewares here
];`;

const getVerifySnippet = (params: Params) => `${
  params.isLogsSelected
    ? `
// Send a log before throwing the error
Sentry.logger.info('User triggered test error', {
  action: 'test_error_worker',
});`
    : ''
}${
  params.isMetricsSelected
    ? `
// Send a test metric before throwing the error
Sentry.metrics.count('test_counter', 1);
`
    : ''
}
setTimeout(() => {
  throw new Error();
});`;

const getPagesVerifySnippet = (params: Params) => `
export function onRequest(context) {${
  params.isLogsSelected
    ? `
  // Send a log before throwing the error
  Sentry.logger.info('User triggered test error', {
    action: 'test_error_function',
  });`
    : ''
}${
  params.isMetricsSelected
    ? `
  // Send a test metric before throwing the error
  Sentry.metrics.count('test_counter', 1);`
    : ''
}
  setTimeout(() => {
    throw new Error();
  });
}`;

const getSetupContent = (params: Params) => {
  if (isPagesSetup(params)) {
    return [
      {
        type: 'alert',
        alertType: 'info',
        text: tct(
          'Cloudflare recommends Workers with static assets over Pages for new projects. If you can, [migrationLink:migrate to Workers] and use one of the Workers setups above.',
          {
            migrationLink: (
              <ExternalLink href="https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/" />
            ),
          }
        ),
      },
      {
        type: 'text',
        text: tct(
          'To use the SDK, add [code:sentryPagesPlugin] as middleware to your Pages application. We recommend a [code:functions/_middleware.js] file, so that Sentry is initialized for your entire app.',
          {code: <code />}
        ),
      },
      {
        type: 'code',
        language: 'javascript',
        filename: 'functions/_middleware.js',
        code: getPagesSetupSnippet(params),
      },
    ] as const;
  }

  if (isViteSetup(params)) {
    return [
      {
        type: 'text',
        text: tct(
          'Add the Sentry plugin to your [code:vite.config.ts], after the [pluginLink:Cloudflare Vite plugin]. It wraps your worker entry, and every Durable Object, Workflow and WorkerEntrypoint class in your wrangler config, at build time.',
          {
            code: <code />,
            pluginLink: (
              <ExternalLink href="https://developers.cloudflare.com/workers/vite-plugin/" />
            ),
          }
        ),
      },
      {
        type: 'code',
        language: 'typescript',
        filename: 'vite.config.ts',
        code: getViteConfigSnippet(),
      },
      {
        type: 'text',
        text: tct(
          'Put your Sentry options in an [code:instrument.server.ts] file next to your worker entry, and default-export them through [code:defineCloudflareOptions]. The plugin picks the file up and hands the options to [code:withSentry], so your worker entry itself stays unchanged.',
          {code: <code />}
        ),
      },
      {
        type: 'code',
        language: 'typescript',
        filename: 'src/instrument.server.ts',
        code: getInstrumentFileSnippet(params),
      },
    ] as const;
  }

  return [
    {
      type: 'text',
      text: tct(
        'In order to initialize the SDK, wrap your handler with the [code:withSentry] function. Note that you can turn off almost all side effects using the respective options.',
        {code: <code />}
      ),
    },
    {
      type: 'code',
      language: 'typescript',
      filename: 'src/index.ts',
      code: getSdkSetupSnippet(params),
    },
  ] as const;
};

export const onboarding: OnboardingConfig<PlatformOptions> = {
  introduction: () =>
    t(
      "In this quick guide you'll set up and configure the Sentry Cloudflare SDK for the use in your Cloudflare Workers or Cloudflare Pages application."
    ),
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: t('Add the Sentry Cloudflare SDK as a dependency:'),
        },
        getInstallCodeBlock(params, {packageName: '@sentry/cloudflare'}),
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: t(
            "Configuration should happen as early as possible in your application's lifecycle."
          ),
        },
        {
          type: 'text',
          text: tct(
            "To use the SDK, you'll need to set the [code:nodejs_compat] compatibility flag in your [code:wrangler.jsonc]/[code:wrangler.toml]. This is because the SDK needs access to the Node.js compatibility APIs to work correctly.",
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JSON',
              language: 'json',
              filename: 'wrangler.jsonc',
              code: getSdkConfigureSnippetJson(),
            },
            {
              label: 'Toml',
              language: 'toml',
              filename: 'wrangler.toml',
              code: getSdkConfigureSnippetToml(),
            },
          ],
        },
        ...getSetupContent(params),
      ],
    },
    getUploadSourceMapsStep({
      guideLink:
        'https://docs.sentry.io/platforms/javascript/guides/cloudflare/sourcemaps/',
      ...params,
    }),
  ],
  verify: params => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: isPagesSetup(params)
            ? getPagesVerifySnippet(params)
            : getVerifySnippet(params),
        },
      ],
    },
  ],
  nextSteps: params => {
    const steps = [
      {
        id: 'cloudflare-features',
        name: t('Cloudflare Features'),
        description: t(
          'Learn about our first class integration with the Cloudflare platform.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/cloudflare/features/',
      },
    ];

    if (params.isLogsSelected) {
      steps.push({
        id: 'logs',
        name: t('Logging Integrations'),
        description: t(
          'Add logging integrations to automatically capture logs from your application.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/cloudflare/logs/#integrations',
      });
    }

    return steps;
  },
};

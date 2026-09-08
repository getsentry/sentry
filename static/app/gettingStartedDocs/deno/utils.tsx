import {ExternalLink} from '@sentry/scraps/link';

import type {
  ContentBlock,
  DocsParams,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {tct} from 'sentry/locale';

export const PACKAGE_NAME = '@sentry/deno';

export const MIN_DENO_VERSION = '2.8.3';

export const sentryImport = `import * as Sentry from "npm:${PACKAGE_NAME}";`;

/**
 * The install step content, shared by every onboarding on this platform.
 *
 * @param text The sentence above the code block, naming the minimum SDK version.
 */
export function getInstallContent(text: React.ReactNode): ContentBlock[] {
  return [
    {type: 'text', text},
    {
      type: 'code',
      tabs: [
        {
          label: 'deno add',
          language: 'bash',
          code: `deno add npm:${PACKAGE_NAME}`,
        },
        {
          label: 'npm specifier',
          language: 'javascript',
          code: sentryImport,
        },
      ],
    },
    {
      type: 'text',
      text: tct('The SDK needs Deno [minVersion] or newer.', {
        minVersion: <code>{MIN_DENO_VERSION}</code>,
      }),
    },
  ];
}

export function getMigrationContent(): ContentBlock {
  return {
    type: 'text',
    text: tct(
      'If you are on an older version of the SDK, follow our [link:migration guide] to upgrade.',
      {
        link: (
          <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/deno/migration/" />
        ),
      }
    ),
  };
}

/**
 * The `Sentry.init()` call, shared by every snippet on this platform so that
 * they cannot drift apart.
 */
export function getSdkInitSnippet(params: DocsParams) {
  return `${sentryImport}

Sentry.init({
  dsn: "${params.dsn.public}",${
    params.isPerformanceSelected
      ? `
  // Set tracesSampleRate to 1.0 to capture 100% of spans for tracing.
  // Learn more at
  // https://docs.sentry.io/platforms/javascript/configuration/options/#traces-sample-rate
  tracesSampleRate: 1.0,`
      : ''
  }

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/deno/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});`;
}

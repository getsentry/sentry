import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

function getInstallSnippet({
  params,
  packageManager,
  additionalPackages = [],
  basePackage = '@sentry/node',
}: {
  packageManager: 'npm' | 'yarn' | 'pnpm';
  params: DocsParams;
  additionalPackages?: string[];
  basePackage?: string;
}) {
  let packages = [basePackage];
  if (params.isProfilingSelected) {
    packages.push('@sentry/profiling-node');
  }
  packages = packages.concat(additionalPackages);

  if (packageManager === 'yarn') {
    return `yarn add ${packages.join(' ')}`;
  }

  if (packageManager === 'pnpm') {
    return `pnpm add ${packages.join(' ')}`;
  }

  return `npm install ${packages.join(' ')} --save`;
}

export function getInstallConfig(
  params: DocsParams,
  {
    basePackage = '@sentry/node',
    additionalPackages,
  }: {
    additionalPackages?: string[];
    basePackage?: string;
  } = {}
) {
  return [
    {
      code: [
        {
          label: 'npm',
          value: 'npm',
          language: 'bash',
          code: getInstallSnippet({
            params,
            additionalPackages,
            packageManager: 'npm',
            basePackage,
          }),
        },
        {
          label: 'yarn',
          value: 'yarn',
          language: 'bash',
          code: getInstallSnippet({
            params,
            additionalPackages,
            packageManager: 'yarn',
            basePackage,
          }),
        },
        {
          label: 'pnpm',
          value: 'pnpm',
          language: 'bash',
          code: getInstallSnippet({
            params,
            additionalPackages,
            packageManager: 'pnpm',
            basePackage,
          }),
        },
      ],
    },
  ];
}

function getImport(
  sdkPackage: 'node' | 'google-cloud-serverless' | 'aws-serverless' | 'nestjs',
  defaultMode?: 'esm' | 'cjs'
): string[] {
  return defaultMode === 'esm'
    ? [
        `// Import with \`const Sentry = require("@sentry/${sdkPackage}");\` if you are using CJS`,
        `import * as Sentry from "@sentry/${sdkPackage}"`,
      ]
    : [
        `// Import with \`import * as Sentry from "@sentry/${sdkPackage}"\` if you are using ESM`,
        `const Sentry = require("@sentry/${sdkPackage}");`,
      ];
}

function getProfilingImport(defaultMode?: 'esm' | 'cjs'): string {
  return defaultMode === 'esm'
    ? `import { nodeProfilingIntegration } from "@sentry/profiling-node";`
    : `const { nodeProfilingIntegration } = require("@sentry/profiling-node");`;
}

/**
 * Import Snippet for the Node and Serverless SDKs without other packages (like profiling).
 */
export function getSentryImportSnippet(
  sdkPackage: 'node' | 'google-cloud-serverless' | 'aws-serverless' | 'nestjs',
  defaultMode?: 'esm' | 'cjs'
): string {
  return getImport(sdkPackage, defaultMode).join('\n');
}

export function getImportInstrumentSnippet(
  defaultMode?: 'esm' | 'cjs',
  fileExtension = 'js'
): string {
  const filename = `instrument.${fileExtension}`;

  return defaultMode === 'esm'
    ? `// IMPORTANT: Make sure to import \`${filename}\` at the top of your file.
// If you're using CommonJS (CJS) syntax, use \`require("./${filename}");\`
import "./${filename}";`
    : `// IMPORTANT: Make sure to import \`${filename}\` at the top of your file.
// If you're using ECMAScript Modules (ESM) syntax, use \`import "./${filename}";\`
require("./${filename}");`;
}

const libraryMap = {
  node: 'node',
  aws: 'aws-serverless',
  gpc: 'google-cloud-serverless',
  nestjs: 'nestjs',
} as const;

function getDefaultNodeImports({
  params,
  sdkImport,
  defaultMode,
}: {
  params: DocsParams;
  sdkImport: 'node' | 'aws' | 'gpc' | 'nestjs' | null;
  defaultMode?: 'esm' | 'cjs';
}) {
  if (sdkImport === null || !libraryMap[sdkImport]) {
    return '';
  }
  const imports: string[] = getImport(libraryMap[sdkImport], defaultMode);

  if (params.isProfilingSelected) {
    imports.push(getProfilingImport(defaultMode));
  }
  return imports.join('\n');
}

/**
 *  Returns the init() with the necessary imports. It is possible to omit the imports.
 */
export const getSdkInitSnippet = (
  params: DocsParams,
  sdkImport: 'node' | 'aws' | 'gpc' | 'nestjs' | null,
  defaultMode?: 'esm' | 'cjs'
) => `${getDefaultNodeImports({params, sdkImport, defaultMode})}

Sentry.init({
  dsn: "${params.dsn.public}",${
    params.isProfilingSelected
      ? `integrations: [
    nodeProfilingIntegration(),
  ],`
      : ''
  }${
    params.isPerformanceSelected
      ? `
      // Tracing
      tracesSampleRate: 1.0, //  Capture 100% of the transactions`
      : ''
  }${
    params.isProfilingSelected &&
    params.profilingOptions?.defaultProfilingMode !== 'continuous'
      ? `
    // Set sampling rate for profiling - this is evaluated only once per SDK.init call
    profilesSampleRate: 1.0,`
      : ''
  }${
    params.isProfilingSelected &&
    params.profilingOptions?.defaultProfilingMode === 'continuous'
      ? `
    // Set sampling rate for profiling - this is evaluated only once per SDK.init call
    profileSessionSampleRate: 1.0,
    // Trace lifecycle automatically enables profiling during active traces
    profileLifecycle: 'trace',`
      : ''
  }
  });${
    params.isProfilingSelected &&
    params.profilingOptions?.defaultProfilingMode === 'continuous'
      ? `

// Profiling happens automatically after setting it up with \`Sentry.init()\`.
// All spans (unless those discarded by sampling) will have profiling data attached to them.
Sentry.startSpan({
  name: "My Span",
}, () => {
  // The code executed here will be profiled
});`
      : ''
  }`;

export const getNodeProfilingOnboarding = ({
  basePackage = '@sentry/node',
  profilingLifecycle = 'trace',
}: {
  basePackage?: string;
  profilingLifecycle?: 'trace' | 'manual';
} = {}): OnboardingConfig => ({
  install: params => [
    {
      type: StepType.INSTALL,
      description: tct(
        'To enable profiling, add [code:@sentry/profiling-node] to your imports.',
        {
          code: <code />,
        }
      ),
      configurations: getInstallConfig(params, {
        basePackage,
      }),
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'Set up the [code:nodeProfilingIntegration] in your [code:Sentry.init()] call.',
        {
          code: <code />,
        }
      ),
      configurations: [
        {
          language: 'javascript',
          code: [
            {
              label: 'Javascript',
              value: 'javascript',
              language: 'javascript',
              code: `
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

Sentry.init({
  dsn: "${params.dsn.public}",
  integrations: [
    nodeProfilingIntegration(),
  ],${
    params.profilingOptions?.defaultProfilingMode === 'continuous'
      ? profilingLifecycle === 'trace'
        ? `
  // Tracing must be enabled for profiling to work
  tracesSampleRate: 1.0,
  // Set sampling rate for profiling - this is evaluated only once per SDK.init call
  profileSessionSampleRate: 1.0,
  // Trace lifecycle automatically enables profiling during active traces
  profileLifecycle: 'trace',`
        : `
  // Tracing is not required for profiling to work
  // but for the best experience we recommend enabling it
  tracesSampleRate: 1.0,
  // Set sampling rate for profiling - this is evaluated only once per SDK.init call
  profileSessionSampleRate: 1.0,`
      : `
  // Tracing must be enabled for profiling to work
  tracesSampleRate: 1.0,
  // Set sampling rate for profiling - this is evaluated only once per SDK.init call
  profilesSampleRate: 1.0,`
  }
});${
                params.profilingOptions?.defaultProfilingMode === 'continuous' &&
                profilingLifecycle === 'trace'
                  ? `

// Profiling happens automatically after setting it up with \`Sentry.init()\`.
// All spans (unless those discarded by sampling) will have profiling data attached to them.
Sentry.startSpan({
  name: "My Span",
}, () => {
  // The code executed here will be profiled
});`
                  : ''
              }${
                params.profilingOptions?.defaultProfilingMode === 'continuous' &&
                profilingLifecycle === 'manual'
                  ? `

Sentry.profiler.startProfiler();
// Code executed between these two calls will be profiled
Sentry.profiler.stopProfiler();
                  `
                  : ''
              }`,
            },
          ],
          additionalInfo:
            profilingLifecycle === 'trace'
              ? tct(
                  'If you need more fine grained control over which spans are profiled, you can do so by [link:enabling manual lifecycle profiling].',
                  {
                    link: (
                      <ExternalLink
                        href={`https://docs.sentry.io/platforms/javascript/guides/node/profiling/node-profiling/#enabling-manual-lifecycle-profiling`}
                      />
                    ),
                  }
                )
              : '',
        },
        {
          description: tct(
            'For more detailed information on profiling, see the [link:profiling documentation].',
            {
              link: (
                <ExternalLink
                  href={`https://docs.sentry.io/platforms/javascript/guides/node/profiling/node-profiling/`}
                />
              ),
            }
          ),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t(
        'Verify that profiling is working correctly by simply using your application.'
      ),
    },
  ],
});

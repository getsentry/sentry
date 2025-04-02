import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';

export function getInstallSnippet({
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

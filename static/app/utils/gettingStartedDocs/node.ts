import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';

export type ProductSelectionMap = Record<ProductSolution, boolean>;

/**
 * Transforms the product selection array into a map of booleans for each product for easier access.
 */
const getProductSelectionMap = (params: DocsParams): ProductSelectionMap => {
  return {
    [ProductSolution.ERROR_MONITORING]: true,
    [ProductSolution.PROFILING]: params.isProfilingSelected,
    [ProductSolution.PERFORMANCE_MONITORING]: params.isPerformanceSelected,
    [ProductSolution.SESSION_REPLAY]: params.isReplaySelected,
  };
};

/**
 * Joins the given lines with the given indentation using \n as delimiter.
 */
export function joinWithIndentation(lines: string[], indent = 2) {
  const indentation = ' '.repeat(indent);
  return lines.map(line => `${indentation}${line}`).join('\n');
}

export function getInstallSnippet({
  params,
  packageManager,
  additionalPackages = [],
  basePackage = '@sentry/node',
}: {
  packageManager: 'npm' | 'yarn';
  params: DocsParams;
  additionalPackages?: string[];
  basePackage?: string;
}) {
  let packages = [basePackage];
  if (params.isProfilingSelected) {
    packages.push('@sentry/profiling-node');
  }
  packages = packages.concat(additionalPackages);

  return packageManager === 'yarn'
    ? `yarn add ${packages.join(' ')}`
    : `npm install --save ${packages.join(' ')}`;
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
      ],
    },
  ];
}

function getImport(
  sdkPackage: 'node' | 'google-cloud-serverless' | 'aws-serverless'
): string[] {
  return [
    `// Import with \`import * as Sentry from "@sentry/${sdkPackage}"\` if you are using ESM`,
    `const Sentry = require("@sentry/${sdkPackage}");`,
  ];
}

/**
 * Import Snippet for the Node and Serverless SDKs without other packages (like profiling).
 */
export function getSentryImportSnippet(
  sdkPackage: 'node' | 'google-cloud-serverless' | 'aws-serverless'
): string {
  return getImport(sdkPackage).join('\n');
}

/**
 * Import Snippet for the Node SDK with other selected packages (like profiling).
 */
export function getDefaultNodeImports({
  productSelection,
}: {
  productSelection: ProductSelectionMap;
}) {
  const imports: string[] = getImport('node');

  if (productSelection.profiling) {
    imports.push(`import { nodeProfilingIntegration } from "@sentry/profiling-node";`);
  }
  return imports;
}

export function getDefaultServerlessImports({
  productSelection,
  library,
}: {
  library: `google-cloud-serverless` | `aws-serverless`;
  productSelection: ProductSelectionMap;
}) {
  const imports: string[] = getImport(library);

  if (productSelection.profiling) {
    imports.push(
      `const { nodeProfilingIntegration } = require("@sentry/profiling-node");`
    );
  }
  return imports;
}

export function getImportInstrumentSnippet(): string {
  return `// IMPORTANT: Make sure to import \`instrument.js\` at the top of your file.
  // If you're using ECMAScript Modules (ESM) syntax, use \`import "./instrument.js";\`
  require("./instrument.js");`;
}

/**
 *  Returns the init() with the necessary imports. It is possible to omit the imports.
 */
export const getSdkInitSnippet = (
  params: DocsParams,
  sdkImport: 'node' | 'aws' | 'gpc' | null
) => `${
  sdkImport === null
    ? ''
    : sdkImport === 'node'
      ? getDefaultNodeImports({productSelection: getProductSelectionMap(params)}).join(
          '\n'
        ) + '\n'
      : sdkImport === 'aws'
        ? getDefaultServerlessImports({
            productSelection: getProductSelectionMap(params),
            library: 'aws-serverless',
          }).join('\n') + '\n'
        : sdkImport === 'gpc'
          ? getDefaultServerlessImports({
              productSelection: getProductSelectionMap(params),
              library: 'google-cloud-serverless',
            }).join('\n') + '\n'
          : ''
}
Sentry.init({
  dsn: "${params.dsn}",
  ${
    params.isProfilingSelected
      ? `integrations: [
    nodeProfilingIntegration(),
  ],`
      : ''
  }${
    params.isPerformanceSelected
      ? `
      // Performance Monitoring
      tracesSampleRate: 1.0, //  Capture 100% of the transactions`
      : ''
  }${
    params.isProfilingSelected
      ? `
    // Set sampling rate for profiling - this is relative to tracesSampleRate
    profilesSampleRate: 1.0,`
      : ''
  }
});
`;

export function getProductIntegrations({
  productSelection,
}: {
  productSelection: ProductSelectionMap;
}) {
  const integrations: string[] = [];
  if (productSelection.profiling) {
    integrations.push(`nodeProfilingIntegration(),`);
  }
  return integrations;
}

export function getDefaultInitParams({dsn}: {dsn: string}) {
  return [`dsn: '${dsn}',`];
}

export function getProductInitParams({
  productSelection,
}: {
  productSelection: ProductSelectionMap;
}) {
  const params: string[] = [];
  if (productSelection['performance-monitoring']) {
    params.push(`// Performance Monitoring`);
    params.push(`tracesSampleRate: 1.0,`);
  }

  if (productSelection.profiling) {
    params.push(
      `// Set sampling rate for profiling - this is relative to tracesSampleRate`
    );
    params.push(`profilesSampleRate: 1.0,`);
  }

  return params;
}

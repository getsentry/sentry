import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';

export type ProductSelectionMap = Record<ProductSolution, boolean>;

/**
 * Transforms the product selection array into a map of booleans for each product for easier access.
 */
export const getProductSelectionMap = (
  activeProductSelection: ProductSolution[]
): ProductSelectionMap => {
  const productSelectionMap: ProductSelectionMap = {
    [ProductSolution.ERROR_MONITORING]: false,
    [ProductSolution.PROFILING]: false,
    [ProductSolution.PERFORMANCE_MONITORING]: false,
    [ProductSolution.SESSION_REPLAY]: false,
  };

  activeProductSelection.forEach(product => {
    productSelectionMap[product] = true;
  });
  return productSelectionMap;
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

export function getDefaultNodeImports({
  productSelection,
}: {
  productSelection: ProductSelectionMap;
}) {
  const imports: string[] = [
    `// You can also use ESM \`import * as Sentry from "@sentry/node"\` instead of \`require\``,
    `const Sentry = require("@sentry/node");`,
  ];
  if (productSelection.profiling) {
    imports.push(`import { ProfilingIntegration } from "@sentry/profiling-node";`);
  }
  return imports;
}

export function getDefaulServerlessImports({
  productSelection,
}: {
  productSelection: ProductSelectionMap;
}) {
  const imports: string[] = [
    `// You can also use ESM \`import * as Sentry from "@sentry/serverless"\` instead of \`require\``,
    `const Sentry = require("@sentry/serverless");`,
  ];
  if (productSelection.profiling) {
    imports.push(`const { ProfilingIntegration } = require("@sentry/profiling-node");`);
  }
  return imports;
}

export function getProductIntegrations({
  productSelection,
}: {
  productSelection: ProductSelectionMap;
}) {
  const integrations: string[] = [];
  if (productSelection.profiling) {
    integrations.push(`new ProfilingIntegration(),`);
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

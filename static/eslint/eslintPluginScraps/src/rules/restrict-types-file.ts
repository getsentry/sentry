import {ESLintUtils, type TSESTree} from '@typescript-eslint/utils';

/**
 * ESLint rule: restrict-types-file
 *
 * A file named `types.ts`/`types.tsx` is meant to be a dependency-free type
 * leaf. Keeping these files type-only stops them from joining the large
 * type-import strongly-connected component that makes "impacted files"
 * analysis flag a huge fraction of the app for almost any change.
 *
 * Two things are enforced:
 *  1. No runtime code — only type-level declarations (type aliases,
 *     interfaces, enums, ambient `declare`s) are allowed.
 *  2. Imports/re-exports may only reference packages or other type leaves
 *     (a `types` file, a path under a `types/` directory, or a `*Base` leaf).
 */

const TYPES_FILE_RE = /(^|[\\/])types\.tsx?$/;

// Roots that resolve to first-party source via tsconfig path aliases. Anything
// else without a leading "." is treated as an external package.
const INTERNAL_ROOTS = new Set([
  'sentry',
  'getsentry',
  'admin',
  'sentry-test',
  'getsentry-test',
  'sentry-fixture',
  'getsentry-fixture',
]);

function isTypesFile(filename: string): boolean {
  return TYPES_FILE_RE.test(filename);
}

function isInternalSource(source: string): boolean {
  if (source.startsWith('.')) {
    return true;
  }
  const root = source.split('/')[0] ?? '';
  return INTERNAL_ROOTS.has(root);
}

function isTypeLeafSource(source: string): boolean {
  const segments = source.split('/').filter(Boolean);
  if (segments.includes('types')) {
    return true;
  }
  const last = segments[segments.length - 1] ?? '';
  const base = last.replace(/\.(tsx?|jsx?)$/, '');
  return /types$/i.test(base) || /Base$/.test(base);
}

function isAllowedSource(source: string): boolean {
  if (!isInternalSource(source)) {
    return true;
  }
  return isTypeLeafSource(source);
}

function isRuntimeDeclaration(node: TSESTree.Node): boolean {
  switch (node.type) {
    case 'FunctionDeclaration':
    case 'ClassDeclaration':
      return true;
    case 'VariableDeclaration':
      return !node.declare;
    default:
      return false;
  }
}

export const restrictTypesFile = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Keep `types.ts`/`types.tsx` files type-only and dependency-free: no runtime code, and imports only from packages or other type files.',
    },
    schema: [],
    messages: {
      runtimeDeclaration:
        'A `types` file must not contain runtime code. Keep only type-level declarations (type aliases, interfaces, enums) here and move values, functions, and classes to a sibling module.',
      disallowedImport:
        'A `types` file may only import from packages or another type file (a `types`/`*Base` leaf). "{{source}}" pulls in a runtime module — move the typedef into a `types` file, or import it from one.',
    },
  },
  create(context) {
    if (!isTypesFile(context.filename)) {
      return {};
    }

    function checkSource(
      node:
        | TSESTree.ImportDeclaration
        | TSESTree.ExportNamedDeclaration
        | TSESTree.ExportAllDeclaration
    ) {
      if (node.source?.type !== 'Literal' || typeof node.source.value !== 'string') {
        return;
      }
      if (!isAllowedSource(node.source.value)) {
        context.report({
          node,
          messageId: 'disallowedImport',
          data: {source: node.source.value},
        });
      }
    }

    return {
      ImportDeclaration: checkSource,
      ExportAllDeclaration: checkSource,
      'Program > ExportNamedDeclaration'(node: TSESTree.ExportNamedDeclaration) {
        if (node.source) {
          checkSource(node);
          return;
        }
        if (node.declaration && isRuntimeDeclaration(node.declaration)) {
          context.report({node: node.declaration, messageId: 'runtimeDeclaration'});
        }
      },
      'Program > ExportDefaultDeclaration'(node: TSESTree.ExportDefaultDeclaration) {
        context.report({node, messageId: 'runtimeDeclaration'});
      },
      'Program > FunctionDeclaration'(node: TSESTree.FunctionDeclaration) {
        context.report({node, messageId: 'runtimeDeclaration'});
      },
      'Program > ClassDeclaration'(node: TSESTree.ClassDeclaration) {
        context.report({node, messageId: 'runtimeDeclaration'});
      },
      'Program > VariableDeclaration'(node: TSESTree.VariableDeclaration) {
        if (!node.declare) {
          context.report({node, messageId: 'runtimeDeclaration'});
        }
      },
      'Program > ExpressionStatement'(node: TSESTree.ExpressionStatement) {
        context.report({node, messageId: 'runtimeDeclaration'});
      },
    };
  },
});

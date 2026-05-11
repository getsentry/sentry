/**
 * ESLint rule: no-calling-components-as-functions
 *
 * Disallows calling React components as functions (e.g., `Component({prop})`)
 * and autofixes to JSX syntax (e.g., `<Component prop={prop} />`).
 *
 * Only flags PascalCase functions that are imported or declared in the current
 * file, so built-in constructors and globals are naturally ignored.
 */
/* eslint-disable import/no-nodejs-modules */
import path from 'node:path';

import {AST_NODE_TYPES, ESLintUtils} from '@typescript-eslint/utils';
import type {TSESTree} from '@typescript-eslint/utils';
import type {RuleFix, RuleFixer} from '@typescript-eslint/utils/ts-eslint';

const IGNORED_NAMES = new Set(['HookOrDefault']);

// Matches names that are clearly not PascalCase components:
// - SCREAMING_SNAKE prefix: DO_NOT_USE_foo, DANGEROUS_SET_REACT_ROUTER_6_HISTORY
// - All-caps constants: BREAKPOINTS, MOBILE
const NOT_PASCAL_CASE_RE = /^[A-Z][A-Z0-9]*_|^[A-Z][A-Z0-9_]*$/;

function shouldSkip(name: string): boolean {
  if (IGNORED_NAMES.has(name)) {
    return true;
  }
  if (name.endsWith('Fixture')) {
    return true;
  }
  if (NOT_PASCAL_CASE_RE.test(name)) {
    return true;
  }
  return false;
}

const IGNORED_IMPORT_PREFIXES = [
  'sentry-fixture/',
  'sentry/components/charts/components/',
  'sentry/components/charts/series/',
];

function isIgnoredImportSource(source: string, filename: string): boolean {
  // Check absolute import paths directly
  if (IGNORED_IMPORT_PREFIXES.some(prefix => source.startsWith(prefix))) {
    return true;
  }

  // Resolve relative imports against the file's directory
  if (source.startsWith('.')) {
    const dir = path.dirname(filename);
    const resolved = path.resolve(dir, source);
    // Normalize to forward slashes and check for chart paths
    const normalized = resolved.replace(/\\/g, '/');
    if (
      normalized.includes('/components/charts/components/') ||
      normalized.includes('/components/charts/series/')
    ) {
      return true;
    }
  }

  return false;
}

export const noCallingComponentsAsFunctions = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow calling React components as functions. Use JSX syntax instead.',
    },
    fixable: 'code',
    schema: [],
    messages: {
      noCallingComponentAsFunction:
        '"{{name}}" appears to be a React component. Use <{{name}} /> instead of calling it as a function.',
    },
  },
  create(context) {
    const knownComponents = new Set<string>();

    return {
      // Track imports: import {Foo} from '...', import Foo from '...'
      ImportDeclaration(node) {
        const source = typeof node.source.value === 'string' ? node.source.value : '';

        if (isIgnoredImportSource(source, context.filename)) {
          return;
        }

        for (const specifier of node.specifiers) {
          if (/^[A-Z]/.test(specifier.local.name)) {
            knownComponents.add(specifier.local.name);
          }
        }
      },

      // Track function declarations: function Foo() {}
      FunctionDeclaration(node) {
        if (node.id && /^[A-Z]/.test(node.id.name)) {
          knownComponents.add(node.id.name);
        }
      },

      // Track variable declarations: const Foo = () => {}, const Foo = function() {}
      VariableDeclarator(node) {
        if (
          node.id.type === AST_NODE_TYPES.Identifier &&
          /^[A-Z]/.test(node.id.name) &&
          node.init &&
          (node.init.type === AST_NODE_TYPES.ArrowFunctionExpression ||
            node.init.type === AST_NODE_TYPES.FunctionExpression)
        ) {
          knownComponents.add(node.id.name);
        }
      },

      CallExpression(node) {
        if (node.callee.type !== AST_NODE_TYPES.Identifier) {
          return;
        }

        const name = node.callee.name;

        if (!knownComponents.has(name)) {
          return;
        }

        if (shouldSkip(name)) {
          return;
        }

        if (node.arguments.length > 1) {
          return;
        }

        const arg = node.arguments[0];

        if (
          arg &&
          arg.type !== AST_NODE_TYPES.ObjectExpression &&
          arg.type !== AST_NODE_TYPES.Identifier
        ) {
          return;
        }

        context.report({
          node,
          messageId: 'noCallingComponentAsFunction',
          data: {name},
          fix(fixer) {
            return buildFix(fixer, node, name, arg);
          },
        });
      },
    };

    function buildFix(
      fixer: RuleFixer,
      node: TSESTree.CallExpression,
      name: string,
      arg: TSESTree.CallExpressionArgument | undefined
    ): RuleFix | null {
      const sourceCode = context.sourceCode;

      if (!arg) {
        return fixer.replaceText(node, `<${name} />`);
      }

      if (arg.type === AST_NODE_TYPES.Identifier) {
        return fixer.replaceText(node, `<${name} {...${arg.name}} />`);
      }

      if (arg.type !== AST_NODE_TYPES.ObjectExpression) {
        return null;
      }

      if (arg.properties.length === 0) {
        return fixer.replaceText(node, `<${name} />`);
      }

      const attrs: string[] = [];
      for (const prop of arg.properties) {
        if (prop.type === AST_NODE_TYPES.SpreadElement) {
          attrs.push(`{...${sourceCode.getText(prop.argument)}}`);
        } else if (prop.type === AST_NODE_TYPES.Property) {
          if (prop.computed) {
            return null;
          }

          const keyName =
            prop.key.type === AST_NODE_TYPES.Identifier
              ? prop.key.name
              : prop.key.type === AST_NODE_TYPES.Literal
                ? String(prop.key.value)
                : null;

          if (keyName === null) {
            return null;
          }

          if (prop.shorthand) {
            attrs.push(`${keyName}={${keyName}}`);
          } else {
            const valueText = sourceCode.getText(prop.value);
            attrs.push(`${keyName}={${valueText}}`);
          }
        }
      }

      return fixer.replaceText(node, `<${name} ${attrs.join(' ')} />`);
    }
  },
});

/**
 * ESLint rule: no-calling-components-as-functions
 *
 * Disallows calling React components as functions (e.g., `Component({prop})`)
 * and autofixes to JSX syntax (e.g., `<Component prop={prop} />`).
 *
 * Only flags PascalCase functions that are imported or declared in the current
 * file, so built-in constructors and globals are naturally ignored.
 */
import {AST_NODE_TYPES, ESLintUtils} from '@typescript-eslint/utils';
import type {TSESTree} from '@typescript-eslint/utils';
import type {RuleFix, RuleFixer} from '@typescript-eslint/utils/ts-eslint';

const IGNORED_NAMES = new Set(['HookOrDefault']);

// Matches SCREAMING_SNAKE_CASE prefixes like DO_NOT_USE_ or DANGEROUS_
const SCREAMING_SNAKE_RE = /^[A-Z][A-Z0-9]*_/;

function shouldSkip(name: string): boolean {
  if (IGNORED_NAMES.has(name)) {
    return true;
  }
  if (name.endsWith('Fixture')) {
    return true;
  }
  if (SCREAMING_SNAKE_RE.test(name)) {
    return true;
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

        // Skip fixture imports — these are data factories, not components
        if (source.startsWith('sentry-fixture/')) {
          return;
        }

        // Skip ECharts config builder imports — not React components
        if (
          source.startsWith('sentry/components/charts/components/') ||
          source.startsWith('sentry/components/charts/series/')
        ) {
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

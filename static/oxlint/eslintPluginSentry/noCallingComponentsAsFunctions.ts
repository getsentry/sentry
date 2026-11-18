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

import {
  defineRule,
  type Definition,
  type ESTree,
  type Fix,
  type Fixer,
  type Scope,
} from '@oxlint/plugins';

const IGNORED_NAMES = new Set(['OverrideOrDefault']);

// Matches names that are clearly not PascalCase components:
// - SCREAMING_SNAKE prefix: DO_NOT_USE_foo, DANGEROUS_SET_FOO
// - All-caps constants: BREAKPOINTS, MOBILE
const NOT_PASCAL_CASE_RE = /^[A-Z][A-Z0-9]*_|^[A-Z][A-Z0-9_]*$/;

const JSX_ATTRIBUTE_NAME_RE = /^[a-z_$][\w$-]*$/iu;

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

export const noCallingComponentsAsFunctions = defineRule({
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
    function isTrackedDefinition(definition: Definition): boolean {
      switch (definition.type) {
        case 'ImportBinding':
          return (
            definition.parent?.type === 'ImportDeclaration' &&
            !isIgnoredImportSource(definition.parent.source.value, context.filename)
          );
        case 'FunctionName':
          return definition.node.type === 'FunctionDeclaration';
        case 'Variable':
          return (
            definition.node.type === 'VariableDeclarator' &&
            (definition.node.init?.type === 'ArrowFunctionExpression' ||
              definition.node.init?.type === 'FunctionExpression')
          );
        default:
          return false;
      }
    }

    function isKnownComponent(node: ESTree.IdentifierReference): boolean {
      for (
        let scope: Scope | null = context.sourceCode.getScope(node);
        scope;
        scope = scope.upper
      ) {
        const variable = scope.set.get(node.name);
        if (variable) {
          return variable.defs.some(isTrackedDefinition);
        }
      }
      return false;
    }

    return {
      CallExpression(node) {
        if (node.callee.type !== 'Identifier') {
          return;
        }

        const name = node.callee.name;

        if (!/^[A-Z]/.test(name) || shouldSkip(name)) {
          return;
        }

        if (node.arguments.length > 1) {
          return;
        }

        const arg = node.arguments[0];

        if (arg && arg.type !== 'ObjectExpression' && arg.type !== 'Identifier') {
          return;
        }

        if (!isKnownComponent(node.callee)) {
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
      fixer: Fixer,
      node: ESTree.CallExpression,
      name: string,
      arg: ESTree.ObjectExpression | ESTree.IdentifierReference | undefined
    ): Fix | null {
      const sourceCode = context.sourceCode;

      if (
        node.optional ||
        node.typeArguments ||
        sourceCode.getCommentsInside(node).length
      ) {
        return null;
      }

      if (!arg) {
        return fixer.replaceText(node, `<${name} />`);
      }

      if (arg.type === 'Identifier') {
        return fixer.replaceText(node, `<${name} {...${arg.name}} />`);
      }

      const attrs: string[] = [];
      const keyNames = new Set<string>();
      for (const prop of arg.properties) {
        if (prop.type === 'SpreadElement') {
          if (prop.argument.type === 'SequenceExpression') {
            return null;
          }
          attrs.push(`{...${sourceCode.getText(prop.argument)}}`);
          continue;
        }

        const keyName =
          prop.key.type === 'Identifier'
            ? prop.key.name
            : prop.key.type === 'Literal'
              ? String(prop.key.value)
              : '';

        if (
          prop.computed ||
          prop.kind !== 'init' ||
          prop.method ||
          keyName === 'key' ||
          keyName === '__proto__' ||
          keyNames.has(keyName) ||
          !JSX_ATTRIBUTE_NAME_RE.test(keyName) ||
          prop.value.type === 'SequenceExpression'
        ) {
          return null;
        }

        keyNames.add(keyName);
        attrs.push(`${keyName}={${sourceCode.getText(prop.value)}}`);
      }

      return fixer.replaceText(node, [`<${name}`, ...attrs, '/>'].join(' '));
    }
  },
});

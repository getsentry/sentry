/**
 * @file Theme binding tracker for scope-aware theme variable resolution.
 *
 * Tracks:
 * - import { useTheme } from '@emotion/react'
 * - const theme = useTheme()
 * - const t = useTheme()
 * - const { tokens } = theme
 * - Callback parameters: (theme) => ..., (p) => p.theme
 */

import type {TSESTree} from '@typescript-eslint/utils';

import type {ThemeBinding, ThemeTracker} from './types';

/**
 * Creates a theme tracker that monitors theme variable bindings across scopes.
 */
export function createThemeTracker(): ThemeTracker {
  /** @type {Set<string>} */
  const themeBindings = new Set();

  const scopeBindings = new Map<number, ThemeBinding>();

  const scopeStack = [0];

  let useThemeImported = false;
  let useThemeLocalName = 'useTheme';
  let scopeIdCounter = 0;

  let moduleBinding: ThemeBinding | null = null;

  return {
    visitors: {
      // Track useTheme import
      ImportDeclaration(node: TSESTree.ImportDeclaration) {
        if (node.source.value !== '@emotion/react') {
          return;
        }

        for (const specifier of node.specifiers) {
          if (
            specifier.type === 'ImportSpecifier' &&
            specifier.imported.type === 'Identifier' &&
            specifier.imported.name === 'useTheme'
          ) {
            useThemeImported = true;
            useThemeLocalName = specifier.local.name;
          }
        }
      },

      // Track const theme = useTheme()
      /** @param {import('estree').VariableDeclarator} node */
      VariableDeclarator(node) {
        if (!useThemeImported) {
          return;
        }

        // Check if init is useTheme()
        if (
          node.init?.type === 'CallExpression' &&
          node.init.callee?.type === 'Identifier' &&
          node.init.callee.name === useThemeLocalName
        ) {
          if (node.id.type === 'Identifier') {
            themeBindings.add(node.id.name);
            moduleBinding = {
              localName: node.id.name,
              source: 'useTheme',
              declarationNode: node,
            };
          } else if (node.id.type === 'ObjectPattern') {
            // const { tokens } = useTheme()
            for (const prop of node.id.properties) {
              if (prop.type === 'Property' && prop.value.type === 'Identifier') {
                themeBindings.add(prop.value.name);
              }
            }
          }
        }
      },

      // Track function/arrow function scopes for callback bindings
      ArrowFunctionExpression() {
        scopeIdCounter++;
        scopeStack.push(scopeIdCounter);
      },
      'ArrowFunctionExpression:exit'() {
        const exitedScope = scopeStack.pop();
        if (exitedScope !== undefined) {
          // Clean up bindings from exited scope
          const binding = scopeBindings.get(exitedScope);
          if (binding) {
            themeBindings.delete(binding.localName);
            scopeBindings.delete(exitedScope);
          }
        }
      },

      FunctionExpression() {
        scopeIdCounter++;
        scopeStack.push(scopeIdCounter);
      },
      'FunctionExpression:exit'() {
        const exitedScope = scopeStack.pop();
        if (exitedScope !== undefined) {
          const binding = scopeBindings.get(exitedScope);
          if (binding) {
            themeBindings.delete(binding.localName);
            scopeBindings.delete(exitedScope);
          }
        }
      },
    },

    isThemeBinding(name) {
      return themeBindings.has(name);
    },

    getActiveBinding() {
      const currentScope = scopeStack[scopeStack.length - 1] ?? 0;
      return scopeBindings.get(currentScope) || moduleBinding;
    },

    getCurrentScopeId() {
      return scopeStack[scopeStack.length - 1] ?? 0;
    },

    registerCallbackBinding(name, node) {
      const currentScope = scopeStack[scopeStack.length - 1] ?? 0;
      const binding: ThemeBinding = {
        localName: name,
        source: 'css-callback',
        declarationNode: node,
      };
      scopeBindings.set(currentScope, binding);
      themeBindings.add(name);
    },
  };
}

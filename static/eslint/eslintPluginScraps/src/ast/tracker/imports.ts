/**
 * @file Stateful import tracker for resolving local names to their import source.
 *
 * Provides an `ImportDeclaration` visitor that records all import specifiers,
 * and a `resolve()` method to look up where a local name was imported from.
 *
 * Usage:
 *   const tracker = createImportTracker();
 *   return {
 *     ...tracker.visitors,
 *     // your other visitors...
 *     SomeNode(node) {
 *       const info = tracker.resolve('Button');
 *       // → { source: '@sentry/scraps/button', imported: 'Button' } or null
 *     },
 *   };
 */

import type {TSESLint, TSESTree} from '@typescript-eslint/utils';

export interface ImportInfo {
  /** The original exported name (e.g., 'Button' even if aliased locally). */
  imported: string;
  /** The module specifier (e.g., '@sentry/scraps/button'). */
  source: string;
}

export interface ImportTracker {
  /**
   * Find the local name(s) for a given import source and exported name.
   * Returns all local aliases (handles `import {Foo as Bar}`).
   */
  findLocalNames(source: string, importedName: string): string[];

  /**
   * Resolve a local name to its import source and original name.
   * Returns null if the name was not imported (or is a local declaration).
   */
  resolve(localName: string): ImportInfo | null;

  /** ESLint visitors to merge into the rule's return object. */
  visitors: TSESLint.RuleListener;
}

/**
 * Creates a stateful import tracker.
 *
 * Merge `tracker.visitors` into your rule's visitor object, then call
 * `tracker.resolve(localName)` to look up any import.
 */
export function createImportTracker(): ImportTracker {
  const imports = new Map<string, ImportInfo>();

  return {
    visitors: {
      ImportDeclaration(node: TSESTree.ImportDeclaration) {
        const source = node.source.value;
        if (typeof source !== 'string') {
          return;
        }

        for (const spec of node.specifiers) {
          switch (spec.type) {
            case 'ImportSpecifier': {
              const imported =
                spec.imported.type === 'Identifier'
                  ? spec.imported.name
                  : spec.imported.value;
              imports.set(spec.local.name, {source, imported});
              break;
            }
            case 'ImportDefaultSpecifier':
              imports.set(spec.local.name, {source, imported: 'default'});
              break;
            case 'ImportNamespaceSpecifier':
              imports.set(spec.local.name, {source, imported: '*'});
              break;
            default:
              break;
          }
        }
      },
    },

    resolve(localName: string): ImportInfo | null {
      return imports.get(localName) ?? null;
    },

    findLocalNames(source: string, importedName: string): string[] {
      const results: string[] = [];
      for (const [localName, info] of imports) {
        if (info.source === source && info.imported === importedName) {
          results.push(localName);
        }
      }
      return results;
    },
  };
}

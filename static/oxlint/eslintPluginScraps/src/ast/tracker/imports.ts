import type {Context, ESTree, Scope, Variable, Visitor} from '@oxlint/plugins';
/**
 * @file Stateful import tracker for resolving local names to their import source.
 *
 * Provides an `ImportDeclaration` visitor and resolves identifiers through
 * their lexical bindings, including imported aliases and shadowing.
 *
 * Usage:
 *   const tracker = createImportTracker(context);
 *   return {
 *     ...tracker.visitors,
 *     // your other visitors...
 *     SomeNode(node) {
 *       const info = tracker.resolve(node);
 *       // → { source: '@sentry/scraps/button', imported: 'Button' } or null
 *     },
 *   };
 */

interface ImportInfo {
  /** The original exported name (e.g., 'Button' even if aliased locally). */
  imported: string;
  /** The module specifier (e.g., '@sentry/scraps/button'). */
  source: string;
}

interface ImportTracker {
  /**
   * Find the local name(s) for a given import source and exported name.
   * Returns all local aliases (handles `import {Foo as Bar}`).
   */
  findLocalNames(source: string, importedName: string): string[];

  /** Check an identifier or JSX tag against an exact import. */
  is(node: ESTree.Node, source: string, importedName: string): boolean;

  /**
   * Resolve an identifier to its import source and original name.
   * Returns null if this exact lexical binding is not a runtime import.
   */
  resolve(node: ESTree.Node): ImportInfo | null;

  /** Resolve the lexical variable referenced by an identifier or JSX tag. */
  resolveVariable(node: ESTree.Node): Variable | undefined;

  /** ESLint visitors to merge into the rule's return object. */
  visitors: Visitor;
}

/**
 * Creates a stateful import tracker.
 *
 * Merge `tracker.visitors` into your rule's visitor object, then call
 * `tracker.resolve(identifier)` to look up the import bound to a reference.
 */
export function createImportTracker(context: Context): ImportTracker {
  const imports = new Map<string, ImportInfo>();

  function resolveVariable(node: ESTree.Node): Variable | undefined {
    if (node.type !== 'Identifier' && node.type !== 'JSXIdentifier') {
      return undefined;
    }
    let scope: Scope | null = context.sourceCode.getScope(node);
    while (scope) {
      const variable = scope.set.get(node.name);
      if (variable) {
        return variable;
      }
      scope = scope.upper;
    }
    return undefined;
  }

  function resolve(node: ESTree.Node): ImportInfo | null {
    const definition = resolveVariable(node)?.defs[0];
    if (
      definition?.type !== 'ImportBinding' ||
      definition.parent?.type !== 'ImportDeclaration' ||
      definition.parent.importKind === 'type' ||
      (definition.node.type === 'ImportSpecifier' &&
        definition.node.importKind === 'type')
    ) {
      return null;
    }
    const specifier = definition.node;
    let imported: string;
    if (specifier.type === 'ImportDefaultSpecifier') {
      imported = 'default';
    } else if (specifier.type === 'ImportNamespaceSpecifier') {
      imported = '*';
    } else if (specifier.type === 'ImportSpecifier') {
      if (specifier.importKind === 'type') {
        return null;
      }
      imported =
        specifier.imported.type === 'Identifier'
          ? specifier.imported.name
          : specifier.imported.value;
    } else {
      return null;
    }
    const source = definition.parent.source.value;
    return typeof source === 'string' ? {source, imported} : null;
  }

  function is(node: ESTree.Node, source: string, importedName: string): boolean {
    if (node.type === 'JSXMemberExpression' && node.property.name === importedName) {
      const info = resolve(node.object);
      return info?.source === source && info.imported === '*';
    }
    if (
      node.type === 'MemberExpression' &&
      !node.computed &&
      node.property.type === 'Identifier' &&
      node.property.name === importedName
    ) {
      const info = resolve(node.object);
      return info?.source === source && info.imported === '*';
    }
    const info = resolve(node);
    return info?.source === source && info.imported === importedName;
  }

  return {
    visitors: {
      ImportDeclaration(node: ESTree.ImportDeclaration) {
        if (node.importKind === 'type') {
          return;
        }
        const source = node.source.value;
        if (typeof source !== 'string') {
          return;
        }

        for (const spec of node.specifiers) {
          if (spec.type === 'ImportSpecifier' && spec.importKind === 'type') {
            continue;
          }
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

    resolveVariable,
    resolve,
    is,

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

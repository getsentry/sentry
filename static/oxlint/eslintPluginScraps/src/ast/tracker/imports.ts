import type {Context, ESTree, Scope, Variable} from '@oxlint/plugins';
/**
 * @file Import tracker for resolving local names to their import source.
 *
 * Resolves identifiers through their lexical bindings, including imported
 * aliases and shadowing.
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
}

export function createImportTracker(context: Context): ImportTracker {
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

  function findLocalNames(source: string, importedName: string): string[] {
    return context.sourceCode.ast.body.flatMap(statement =>
      statement.type === 'ImportDeclaration'
        ? statement.specifiers.flatMap(({local}) => {
            const info = resolve(local);
            return info?.source === source && info.imported === importedName
              ? [local.name]
              : [];
          })
        : []
    );
  }

  return {findLocalNames, resolveVariable, resolve, is};
}

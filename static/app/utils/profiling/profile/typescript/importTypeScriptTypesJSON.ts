// https://github.com/microsoft/typescript-analyze-trace/blob/9e2c745ea424911d364b0c8d37998d77e8373049/src/simplify-type.ts
function expandTypeFlags41(flags41: number): TypeScriptTypes.TypeFlag[] {
  const flags: TypeScriptTypes.TypeFlag[] = [];

  if (flags41 & (1 << 0)) {
    flags.push('Any');
  }
  if (flags41 & (1 << 1)) {
    flags.push('Unknown');
  }
  if (flags41 & (1 << 2)) {
    flags.push('String');
  }
  if (flags41 & (1 << 3)) {
    flags.push('Number');
  }
  if (flags41 & (1 << 4)) {
    flags.push('Boolean');
  }
  if (flags41 & (1 << 5)) {
    flags.push('Enum');
  }
  if (flags41 & (1 << 6)) {
    flags.push('BigInt');
  }
  if (flags41 & (1 << 7)) {
    flags.push('StringLiteral');
  }
  if (flags41 & (1 << 8)) {
    flags.push('NumberLiteral');
  }
  if (flags41 & (1 << 9)) {
    flags.push('BooleanLiteral');
  }
  if (flags41 & (1 << 10)) {
    flags.push('EnumLiteral');
  }
  if (flags41 & (1 << 11)) {
    flags.push('BigIntLiteral');
  }
  if (flags41 & (1 << 12)) {
    flags.push('ESSymbol');
  }
  if (flags41 & (1 << 13)) {
    flags.push('UniqueESSymbol');
  }
  if (flags41 & (1 << 14)) {
    flags.push('Void');
  }
  if (flags41 & (1 << 15)) {
    flags.push('Undefined');
  }
  if (flags41 & (1 << 16)) {
    flags.push('Null');
  }
  if (flags41 & (1 << 17)) {
    flags.push('Never');
  }
  if (flags41 & (1 << 18)) {
    flags.push('TypeParameter');
  }
  if (flags41 & (1 << 19)) {
    flags.push('Object');
  }
  if (flags41 & (1 << 20)) {
    flags.push('Union');
  }
  if (flags41 & (1 << 21)) {
    flags.push('Intersection');
  }
  if (flags41 & (1 << 22)) {
    flags.push('Index');
  }
  if (flags41 & (1 << 23)) {
    flags.push('IndexedAccess');
  }
  if (flags41 & (1 << 24)) {
    flags.push('Conditional');
  }
  if (flags41 & (1 << 25)) {
    flags.push('Substitution');
  }
  if (flags41 & (1 << 26)) {
    flags.push('NonPrimitive');
  }
  if (flags41 & (1 << 27)) {
    flags.push('TemplateLiteral');
  }
  if (flags41 & (1 << 28)) {
    flags.push('StringMapping');
  }

  return flags;
}

function getTypeFlags(flags: readonly string[]): readonly TypeScriptTypes.TypeFlag[] {
  // Traces from TS 4.1 contained numeric flags, rather than their string equivalents
  return flags.length === 1 && /^\d+$/.test(flags[0])
    ? expandTypeFlags41(+flags[0])
    : (flags as TypeScriptTypes.TypeFlag[]);
}

/// ///////////////// End of copied code //////////////////////////

function getChildrenTypesToVisit(node: TypeScriptTypes.TypeDescriptor): number[] {
  return node?.unionTypes ?? node?.intersectionTypes ?? node.typeArguments ?? [];
}

function getTypeName(node: TypeScriptTypes.TypeDescriptor): string | undefined {
  return node.display || node.intrinsicName || node.symbolName;
}

export const TS_SYMBOLS: Partial<Record<TypeScriptTypes.TypeFlag, string>> = {
  Union: '|',
  Intersection: '&',
};
class TypeTree implements TypeScriptTypes.TypeTree {
  tree = {};

  resolveTypeTreeForId(
    rootId: TypeScriptTypes.TypeDescriptor['id']
  ): TypeScriptTypes.ResolvedTree | null {
    const rootNode: TypeScriptTypes.ResolvedTree = {
      type: this.queryByTypeId(rootId),
      children: [],
    };

    const visit = (
      parent: TypeScriptTypes.ResolvedTree,
      typeId: TypeScriptTypes.TypeDescriptor['id']
    ) => {
      const node: TypeScriptTypes.ResolvedTree = {
        type: this.queryByTypeId(typeId),
        children: [],
      };

      if (node.type) {
        getChildrenTypesToVisit(node.type).forEach(child => {
          visit(node, child);
        });
      }

      parent.children.push(node);
    };

    if (rootNode.type) {
      getChildrenTypesToVisit(rootNode.type).forEach(child => {
        visit(rootNode, child);
      });
    }

    return rootNode;
  }

  queryByTypeId(id: number): TypeScriptTypes.TypeDescriptor | undefined {
    return this.tree[id];
  }

  indexType(type: TypeScriptTypes.TypeDescriptor): TypeScriptTypes.TypeDescriptor {
    this.tree[type.id] = {...type, flags: getTypeFlags(type.flags ?? [])};
    return this.tree[type.id];
  }
}

export function getResolvedTypescriptTypeName(
  resolvedTree: TypeScriptTypes.ResolvedTree,
  tree: TypeScriptTypes.TypeTree
): string | undefined {
  if (resolvedTree.type === undefined) {
    throw new Error('Resolved node does not belong to type declaration');
  }

  function visit(child: TypeScriptTypes.ResolvedTree): string | undefined {
    if (!child.type) {
      throw new Error('Resolved node does not belong to type declaration');
    }

    const name = getTypeName(child.type);

    if (name !== undefined) {
      const typeArguments =
        child.type.typeArguments?.map(id => {
          const node = tree.queryByTypeId(id);
          return node ? getTypeName(node) : undefined;
        }) ?? [];

      return typeArguments?.length > 0 ? `${name}<${typeArguments.join(', ')}>` : name;
    }

    const typestring: string[] = [];

    for (let i = 0; i < child.children.length; i++) {
      const names = visit(child.children[i]);

      if (names) {
        typestring.push(names);
      }
    }

    if (!typestring.length) {
      return undefined;
    }

    return `(${
      child.type.flags
        ? typestring.join(` ${TS_SYMBOLS[child.type.flags[0]]} `)
        : typestring.join(' ')
    })`;
  }

  const name = getTypeName(resolvedTree.type);

  if (name !== undefined) {
    const typeArguments =
      resolvedTree.type.typeArguments?.map(id => {
        const node = tree.queryByTypeId(id);
        return node ? getTypeName(node) : undefined;
      }) ?? [];

    return typeArguments.length > 0 ? `${name}<${typeArguments.join(', ')}>` : name;
  }

  const typestring: string[] = [];

  for (let i = 0; i < resolvedTree.children.length; i++) {
    const names = visit(resolvedTree.children[i]);
    if (names) {
      typestring.push(names);
    }
  }

  if (!typestring.length) {
    return undefined;
  }

  return resolvedTree.type.flags
    ? typestring.join(` ${TS_SYMBOLS[resolvedTree.type.flags[0]]} `)
    : typestring.join(' ');
}

export function importTypeScriptTypesJSON(
  input: TypeScriptTypes.TypeDescriptor[]
): TypeScriptTypes.TypeTree {
  const tree = new TypeTree();

  while (input.length > 0) {
    const type = input.pop();

    if (type === undefined) {
      throw new Error('Empty type queue');
    }

    tree.indexType(type);
  }

  return tree;
}

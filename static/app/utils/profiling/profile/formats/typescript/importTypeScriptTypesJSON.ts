import {getTypeFlags} from './helpers';

function getChildrenTypesToVisit(node: TypeScript.TypeDescriptor): number[] {
  return node?.unionTypes ?? node?.intersectionTypes ?? node.typeArguments ?? [];
}

function getTypeName(node: TypeScript.TypeDescriptor): string | undefined {
  return node.display || node.intrinsicName || node.symbolName;
}

function hasTypeArguments(descriptor: TypeScript.TypeDescriptor): boolean {
  return (descriptor?.typeArguments?.length ?? 0) > 0;
}

export function getResolvedTypescriptTypeName(
  resolvedTree: TypeScript.ResolvedTree,
  tree: TypeScript.TypeTree
): string | undefined {
  if (resolvedTree.type === undefined) {
    throw new Error('Resolved node does not belong to type declaration');
  }

  function visit(child: TypeScript.ResolvedTree): string | undefined {
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

export const TS_SYMBOLS: Partial<Record<TypeScript.TypeFlag, string>> = {
  Union: '|',
  Intersection: '&',
};
class TypeTree implements TypeScript.TypeTree {
  tree = {};

  resolveTypeTreeForId(
    rootId: TypeScript.TypeDescriptor['id']
  ): TypeScript.ResolvedTree | null {
    const rootNode: TypeScript.ResolvedTree = {
      type: this.queryByTypeId(rootId),
      children: [],
    };

    const visit = (
      parent: TypeScript.ResolvedTree,
      typeId: TypeScript.TypeDescriptor['id']
    ) => {
      const node: TypeScript.ResolvedTree = {
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

  queryByTypeId(id: number): TypeScript.TypeDescriptor | undefined {
    return this.tree[id];
  }

  indexType(type: TypeScript.TypeDescriptor): TypeScript.TypeDescriptor {
    this.tree[type.id] = {...type, flags: getTypeFlags(type.flags ?? [])};
    return this.tree[type.id];
  }
}

export function importTypeScriptJSON(
  input: TypeScript.TypeDescriptor[]
): TypeScript.TypeTree {
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

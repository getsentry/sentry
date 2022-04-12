import {getTypeFlags} from './helpers';

// The order is based off running cat types.json | grep name | wc -l.
// I've looked at the output and tried reasoning about the order, in general it seems that
// if we have a displayName, then that is the full display name of the type (same as what you)
// would see if you hover over a type in your editor. But there are some cases where the
// display is not present - see comment in https://github.com/microsoft/TypeScript/blob/main/src/compiler/tracing.ts#L209-L218
export function getTypeName(
  typeDescriptor: TypeScript.TypeDescriptor
): string | undefined {
  if (typeDescriptor.display) {
    return typeDescriptor.display;
  }

  // XXX: we need to resolve our own type tree here. For now just fallback to other properties.
  return typeDescriptor.symbolName || typeDescriptor.intrinsicName;
}

export const TS_SYMBOLS: Partial<Record<TypeScript.TypeFlag, string>> = {
  Union: '|',
  Intersection: '&',
};
class TypeTree implements TypeScript.TypeTree {
  tree = {};

  // XXX: in most cases, it is helpful to show the entire type tree for a constructed type
  // to do that, we need to recursively resolve children types based off the type descriptor flags.
  resolveTypeTreeForId(
    _rootId: TypeScript.TypeDescriptor['id']
  ): TypeScript.TreeNode | null {
    return null;
  }

  queryByTypeId(id: number): TypeScript.TypeDescriptor | undefined {
    return this.tree[id];
  }

  indexType(type: TypeScript.TypeDescriptor): TypeScript.TypeDescriptor {
    this.tree[type.id] = {...type, flags: getTypeFlags(type.flags ?? [])};
    return this.tree[type.id];
  }
}

export function importTypeScriptTypesJSON(
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

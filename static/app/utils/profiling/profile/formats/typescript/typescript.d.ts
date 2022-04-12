// https://github.com/microsoft/TypeScript/blob/7e3eccedd70de40a40425e2a1fb6bbc61965762a/src/compiler/tracing.ts
namespace TypeScript {
  interface TypeLocationDescriptor {
    path: string;
    start: {
      line: number;
      character: number;
    };
    end: {
      line: number;
      chartacter: number;
    };
  }

  type TypeFlag =
    | 'Any'
    | 'Unknown'
    | 'String'
    | 'Number'
    | 'Boolean'
    | 'Enum'
    | 'BigInt'
    | 'StringLiteral'
    | 'NumberLiteral'
    | 'BooleanLiteral'
    | 'EnumLiteral'
    | 'BigIntLiteral'
    | 'ESSymbol'
    | 'UniqueESSymbol'
    | 'Void'
    | 'Undefined'
    | 'Null'
    | 'Never'
    | 'TypeParameter'
    | 'Object'
    | 'Union'
    | 'Intersection'
    | 'Index'
    | 'IndexedAccess'
    | 'Conditional'
    | 'Substitution'
    | 'NonPrimitive'
    | 'TemplateLiteral'
    | 'StringMapping';

  interface TypeDescriptor {
    id: number;
    intrinsicName?: string;
    symbolName?: string;
    recursionId?: number;
    isTuple?: boolean;
    unionTypes?: number[];
    intersectionTypes?: number[];
    aliasTypeArguments?: number[];
    keyofType?: number;
    destructuringPattern?: TypeLocationDescriptor;
    firstDeclaration?: TypeLocationDescriptor;

    display?: string;
    flags?: TypeFlag[];

    // extra index accessed type properties
    indexedAccessObjectType?: number;
    indexedAccessIndexType?: number;
    instantiatedType?: number;

    // extra referenced type properties
    typeArguments?: number[];
    referenceLocation?: TypeLocationDescriptor;

    // extra conditional type properties
    conditionalCheckType?: number;
    conditionalExtendsType?: number;
    conditionalTrueType?: number | -1;
    conditionalFalseType?: number | -1;

    // substitutional types
    substitutionBaseType?: number;
    substituteType?: number;

    // reverse mapped types
    reverseMappedSourceType?: number;
    reverseMappedMappedType?: number;
    reverseMappedConstraintType?: number;

    // evolving array
    evolvingArrayElementType?: number;
    evolvingArrayFinalType?: number;
  }

  interface TreeNode {
    children: TreeNode[];
    type: TypeScript.TypeDescriptor;
  }
  interface TypeTree {
    tree: Record<TypeDescriptor['id'], TypeScript.TypeDescriptor>;
    indexType(type: TypeScript.TypeDescriptor): TypeScript.TypeDescriptor;
    queryByTypeId(id: number): TypeScript.TypeDescriptor | undefined;
    resolveTypeTreeForId(id: number): TreeNode | null;
  }
}

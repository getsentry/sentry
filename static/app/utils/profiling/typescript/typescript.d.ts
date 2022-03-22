// https://github.com/microsoft/TypeScript/blob/7e3eccedd70de40a40425e2a1fb6bbc61965762a/src/compiler/tracing.ts
namespace TypeScriptTypes {
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
    indexedAccessObjectType?: number | undefined;
    indexedAccessIndexType?: number | undefined;
    instantiatedType?: number | undefined;

    // extra referenced type properties
    typeArguments?: number[] | undefined;
    referenceLocation?: TypeLocationDescriptor;

    // extra conditional type properties
    conditionalCheckType?: number | undefined;
    conditionalExtendsType?: number | undefined;
    conditionalTrueType?: number | -1;
    conditionalFalseType?: number | -1;

    // substitutional types
    substitutionBaseType?: number | undefined;
    substituteType?: number | undefined;

    // reverse mapped types
    reverseMappedSourceType?: number | undefined;
    reverseMappedMappedType?: number | undefined;
    reverseMappedConstraintType?: number | undefined;

    // evolving array
    evolvingArrayElementType?: number;
    evolvingArrayFinalType?: number | undefined;
  }

  type TreeNode = {
    node: TypeScriptTypes.TypeDescriptor;
  };

  interface TypeTree {
    tree: Record<TypeDescriptor['id'], TreeNode>;
    indexType(type: TypeScriptTypes.TypeDescriptor): TreeNode;
    queryByTypeId(id: number): TreeNode | undefined;
  }
}

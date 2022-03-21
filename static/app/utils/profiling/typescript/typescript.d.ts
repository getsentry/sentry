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
    flags?: string[];

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
    flags: ReadonlyArray<TypeFlag>;
    node: TypeScriptTypes.TypeDescriptor;
  };

  type TypeTree = Record<TypeDescriptor['id'], TreeNode>;
}

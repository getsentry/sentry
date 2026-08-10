import ts from 'typescript';

export type UnnecessaryTypeAnnotation = ts.VariableDeclaration & {
  initializer: ts.Expression;
  name: ts.Identifier;
  type: ts.TypeNode;
};

const escapeHatchTypeFlags = ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never;

function dependsOnContextualType(node: ts.Node): boolean {
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    if (node.parameters.some(parameter => !parameter.type)) {
      return true;
    }

    // The outer variable annotation does not contextually type functions
    // declared inside a block body.
    if (ts.isBlock(node.body)) {
      return false;
    }
  }

  return Boolean(ts.forEachChild(node, dependsOnContextualType));
}

export function createUnnecessaryTypeAnnotationFinder(checker: ts.TypeChecker) {
  const containsAnyCache = new Map<ts.Type, boolean>();

  function typeContainsAny(type: ts.Type, seen = new Set<ts.Type>()): boolean {
    const cached = containsAnyCache.get(type);
    if (cached !== undefined) {
      return cached;
    }
    if ((type.flags & ts.TypeFlags.Any) !== 0) {
      containsAnyCache.set(type, true);
      return true;
    }
    if (seen.has(type)) {
      return false;
    }

    seen.add(type);
    const typeArguments = checker.getTypeArguments(type as ts.TypeReference);
    const containsAny =
      typeArguments.some(argument => typeContainsAny(argument, seen)) ||
      (type.isUnionOrIntersection() &&
        type.types.some(member => typeContainsAny(member, seen)));
    seen.delete(type);
    containsAnyCache.set(type, containsAny);
    return containsAny;
  }

  function typesAreEquivalent(a: ts.Type, b: ts.Type): boolean {
    if (a === b) {
      return true;
    }
    if (!checker.isTypeAssignableTo(a, b) || !checker.isTypeAssignableTo(b, a)) {
      return false;
    }

    const propertiesA = checker.getPropertiesOfType(a);
    const propertiesB = checker.getPropertiesOfType(b);
    if (propertiesA.length !== propertiesB.length) {
      return false;
    }

    const propertyNamesB = new Set(propertiesB.map(property => property.getName()));
    if (propertiesA.some(property => !propertyNamesB.has(property.getName()))) {
      return false;
    }

    // Record<string, T> and {} can be mutually assignable with the same named
    // properties even though the annotation adds an index signature.
    return (
      checker.getIndexInfosOfType(a).length === checker.getIndexInfosOfType(b).length
    );
  }

  function isUnnecessary(
    node: ts.VariableDeclaration
  ): node is UnnecessaryTypeAnnotation {
    const declarationFlags = ts.getCombinedNodeFlags(node.parent);
    const isConst = (declarationFlags & ts.NodeFlags.Const) !== 0;
    const isLet = (declarationFlags & ts.NodeFlags.Let) !== 0;

    if (
      (!isConst && !isLet) ||
      !ts.isIdentifier(node.name) ||
      !node.type ||
      !node.initializer ||
      ts.isObjectLiteralExpression(node.initializer) ||
      ts.isArrayLiteralExpression(node.initializer) ||
      dependsOnContextualType(node.initializer)
    ) {
      return false;
    }

    const annotationType = checker.getTypeFromTypeNode(node.type);
    if ((annotationType.flags & escapeHatchTypeFlags) !== 0) {
      return false;
    }

    let inferredType = checker.getTypeAtLocation(node.initializer);
    if ((inferredType.flags & ts.TypeFlags.TypeParameter) !== 0) {
      return false;
    }
    if (isLet && (inferredType.flags & ts.TypeFlags.Union) === 0) {
      inferredType = checker.getBaseTypeOfLiteralType(inferredType);
    }

    return (
      !typeContainsAny(inferredType) && typesAreEquivalent(annotationType, inferredType)
    );
  }

  return function findUnnecessaryTypeAnnotations(
    sourceFile: ts.SourceFile
  ): UnnecessaryTypeAnnotation[] {
    const declarations: UnnecessaryTypeAnnotation[] = [];

    function visit(node: ts.Node): void {
      if (ts.isVariableDeclaration(node) && isUnnecessary(node)) {
        declarations.push(node);
      }
      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return declarations;
  };
}

export function removeUnnecessaryTypeAnnotations(
  sourceFile: ts.SourceFile,
  declarations: UnnecessaryTypeAnnotation[]
): string {
  let output = sourceFile.text;

  for (const declaration of declarations.toSorted((a, b) => b.name.end - a.name.end)) {
    output = output.slice(0, declaration.name.end) + output.slice(declaration.type.end);
  }

  return output;
}

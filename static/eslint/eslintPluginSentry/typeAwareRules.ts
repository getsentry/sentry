import ts from 'typescript';

const escapeHatchTypeFlags = ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never;

function isEscapeHatch(type: ts.Type): boolean {
  return (type.flags & escapeHatchTypeFlags) !== 0;
}

function containsUntypedFunction(node: ts.Node): boolean {
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    if (node.parameters.some(parameter => !parameter.type)) {
      return true;
    }

    // Functions declared inside a block body are not contextually typed by the
    // variable annotation outside that body.
    if (ts.isBlock(node.body)) {
      return false;
    }
  }

  let found = false;
  ts.forEachChild(node, child => {
    if (!found && containsUntypedFunction(child)) {
      found = true;
    }
  });
  return found;
}

/** Create the semantic checks shared by the standalone lint runner and its tests. */
export function createTypeAwareRuleChecks(checker: ts.TypeChecker) {
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

  function typesAreIdentical(a: ts.Type, b: ts.Type): boolean {
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

  function isUnnecessaryTypeAnnotation(node: ts.VariableDeclaration): boolean {
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
      containsUntypedFunction(node.initializer)
    ) {
      return false;
    }

    const annotationType = checker.getTypeFromTypeNode(node.type);
    if (isEscapeHatch(annotationType)) {
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
      !typeContainsAny(inferredType) && typesAreIdentical(annotationType, inferredType)
    );
  }

  return {isUnnecessaryTypeAnnotation};
}

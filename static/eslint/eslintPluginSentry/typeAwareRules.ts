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

function isConstTypeReference(type: ts.TypeNode): boolean {
  return (
    ts.isTypeReferenceNode(type) &&
    ts.isIdentifier(type.typeName) &&
    type.typeName.text === 'const'
  );
}

function isAssignment(node: ts.Node): boolean {
  return (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
    node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
  );
}

function hasExcludedNarrowingParent(node: ts.AsExpression): boolean {
  let current: ts.Node = node;
  while (ts.isParenthesizedExpression(current.parent)) {
    current = current.parent;
  }

  return (
    ts.isVariableDeclaration(current.parent) ||
    isAssignment(current.parent) ||
    ts.isSpreadElement(current.parent) ||
    ts.isSpreadAssignment(current.parent)
  );
}

function isTransparentPropertyWrapper(node: ts.Node): boolean {
  if (ts.isConditionalExpression(node) || ts.isParenthesizedExpression(node)) {
    return true;
  }

  return (
    ts.isBinaryExpression(node) &&
    (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
      node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
      node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
      node.operatorToken.kind === ts.SyntaxKind.CommaToken)
  );
}

function isInsideObjectProperty(node: ts.AsExpression): boolean {
  let current: ts.Node = node;
  while (current.parent) {
    const parent = current.parent;
    if (ts.isPropertyAssignment(parent)) {
      return true;
    }
    if (isTransparentPropertyWrapper(parent)) {
      current = parent;
      continue;
    }
    break;
  }
  return false;
}

function isGenericCallContainer(node: ts.Node): boolean {
  return (
    ts.isPropertyAssignment(node) ||
    ts.isObjectLiteralExpression(node) ||
    ts.isArrayLiteralExpression(node) ||
    ts.isSpreadElement(node) ||
    ts.isSpreadAssignment(node) ||
    ts.isParenthesizedExpression(node)
  );
}

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

  function isArgumentToGenericCall(node: ts.AsExpression): boolean {
    let current: ts.Node = node;
    while (current.parent) {
      const parent = current.parent;
      if (
        ts.isCallExpression(parent) &&
        parent.arguments.includes(current as ts.Expression)
      ) {
        if (parent.typeArguments?.length) {
          return false;
        }

        return checker
          .getTypeAtLocation(parent.expression)
          .getCallSignatures()
          .some(signature => Boolean(signature.getTypeParameters()?.length));
      }
      if (isGenericCallContainer(parent)) {
        current = parent;
        continue;
      }
      break;
    }
    return false;
  }

  function isUnnecessaryTypeNarrowing(node: ts.AsExpression): boolean {
    // Bail out syntactically before asking the checker anything. These cases
    // account for most assertions in the repository.
    if (
      isConstTypeReference(node.type) ||
      ts.isObjectLiteralExpression(node.expression) ||
      ts.isArrayLiteralExpression(node.expression) ||
      hasExcludedNarrowingParent(node) ||
      isInsideObjectProperty(node)
    ) {
      return false;
    }

    const assertedType = checker.getTypeFromTypeNode(node.type);
    if (isEscapeHatch(assertedType)) {
      return false;
    }

    if (
      ts.isAsExpression(node.expression) &&
      isEscapeHatch(checker.getTypeFromTypeNode(node.expression.type))
    ) {
      return false;
    }

    const originalType = checker.getTypeAtLocation(node.expression);
    if (typeContainsAny(originalType)) {
      return false;
    }

    const primitiveFlags =
      ts.TypeFlags.String |
      ts.TypeFlags.Number |
      ts.TypeFlags.Boolean |
      ts.TypeFlags.BigInt;
    if (
      (originalType.flags & primitiveFlags) !== 0 &&
      checker.isTypeAssignableTo(assertedType, originalType) &&
      !checker.isTypeAssignableTo(originalType, assertedType)
    ) {
      return false;
    }

    if (isArgumentToGenericCall(node)) {
      return false;
    }

    const contextualType = checker.getContextualType(node);
    return Boolean(
      contextualType && checker.isTypeAssignableTo(originalType, contextualType)
    );
  }

  return {isUnnecessaryTypeAnnotation, isUnnecessaryTypeNarrowing};
}

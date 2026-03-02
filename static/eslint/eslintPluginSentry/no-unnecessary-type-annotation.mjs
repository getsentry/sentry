import ts from 'typescript';

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow type annotations that match the inferred type',
    },
    fixable: 'code',
    schema: [],
    messages: {
      unnecessary: 'Type annotation is unnecessary — TypeScript infers the same type.',
    },
  },

  create(context) {
    const parserServices = context.sourceCode.parserServices;
    if (!parserServices?.program || !parserServices?.esTreeNodeToTSNodeMap) {
      return {};
    }

    const checker = parserServices.program.getTypeChecker();
    const toTSNode = parserServices.esTreeNodeToTSNodeMap;

    function typesAreIdentical(a, b) {
      return checker.isTypeAssignableTo(a, b) && checker.isTypeAssignableTo(b, a);
    }

    function isEscapeHatch(type) {
      return (
        (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never)) !==
        0
      );
    }

    /**
     * Returns true if the type contains `any` at any level, including
     * within type arguments (e.g. Promise<any>, Array<any>, Map<string, any>).
     */
    function containsAny(type) {
      if ((type.flags & ts.TypeFlags.Any) !== 0) {
        return true;
      }
      const typeArgs = checker.getTypeArguments(type);
      if (typeArgs) {
        return typeArgs.some(arg => containsAny(arg));
      }
      return false;
    }

    /**
     * Returns true if a CallExpression has any function arguments whose
     * parameters lack explicit type annotations. These callbacks rely on
     * contextual typing from the variable's annotation.
     */
    function hasUntypedCallbacks(callNode) {
      return callNode.arguments.some(arg => {
        if (arg.type !== 'ArrowFunctionExpression' && arg.type !== 'FunctionExpression') {
          return false;
        }
        return arg.params.some(param => !param.typeAnnotation);
      });
    }

    return {
      VariableDeclarator(node) {
        // Only const declarations
        if (node.parent?.type !== 'VariableDeclaration' || node.parent.kind !== 'const') {
          return;
        }

        // Only simple identifiers (skip destructuring)
        if (node.id.type !== 'Identifier') {
          return;
        }

        // Must have both annotation and initializer
        if (!node.id.typeAnnotation || !node.init) {
          return;
        }

        // Skip object/array literals — `prefer-satisfies-for-objects` handles these.
        // Skip function expressions — the annotation provides contextual parameter
        // types (e.g. `e` in event handlers). Without it, params become `any`.
        if (
          node.init.type === 'ObjectExpression' ||
          node.init.type === 'ArrayExpression' ||
          node.init.type === 'ArrowFunctionExpression' ||
          node.init.type === 'FunctionExpression'
        ) {
          return;
        }

        // Skip call expressions that contain untyped callback arguments.
        // The variable's type annotation provides contextual typing that flows
        // through the call's generics into callback parameters (e.g. useCallback).
        if (node.init.type === 'CallExpression' && hasUntypedCallbacks(node.init)) {
          return;
        }

        const annotationTSNode = toTSNode.get(node.id.typeAnnotation.typeAnnotation);
        const initTSNode = toTSNode.get(node.init);
        if (!annotationTSNode || !initTSNode) {
          return;
        }

        const annotationType = checker.getTypeFromTypeNode(annotationTSNode);
        const inferredType = checker.getTypeAtLocation(initTSNode);

        if (isEscapeHatch(annotationType) || containsAny(inferredType)) {
          return;
        }

        if (typesAreIdentical(annotationType, inferredType)) {
          context.report({
            node: node.id.typeAnnotation,
            messageId: 'unnecessary',
            fix(fixer) {
              return fixer.remove(node.id.typeAnnotation);
            },
          });
        }
      },
    };
  },
};

export default rule;

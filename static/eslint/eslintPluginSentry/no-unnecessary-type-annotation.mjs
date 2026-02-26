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

    return {
      VariableDeclarator(node) {
        // Only const declarations
        if (
          !node.parent ||
          node.parent.type !== 'VariableDeclaration' ||
          node.parent.kind !== 'const'
        ) {
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

        // Skip object and array literal initializers — a future `prefer-satisfies`
        // rule will handle these. For literals, TypeScript contextually types the
        // expression using the annotation, so the inferred type always matches.
        if (
          node.init.type === 'ObjectExpression' ||
          node.init.type === 'ArrayExpression'
        ) {
          return;
        }

        const annotationTSNode = toTSNode.get(node.id.typeAnnotation.typeAnnotation);
        const initTSNode = toTSNode.get(node.init);
        if (!annotationTSNode || !initTSNode) {
          return;
        }

        const annotationType = checker.getTypeFromTypeNode(annotationTSNode);
        const initType = checker.getTypeAtLocation(initTSNode);

        if (isEscapeHatch(annotationType) || isEscapeHatch(initType)) {
          return;
        }

        if (typesAreIdentical(annotationType, initType)) {
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

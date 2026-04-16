import {ESLintUtils, type TSESTree} from '@typescript-eslint/utils';
import {getParserServices} from '@typescript-eslint/utils/eslint-utils';
import ts from 'typescript';

export const noUnnecessaryTypeNarrowing = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow `as T` type assertions that narrow unnecessarily when the original type is already assignable to the contextual target type',
    },
    fixable: 'code',
    schema: [],
    messages: {
      unnecessary:
        'Type assertion is unnecessary: the original type is already assignable to the expected type.',
    },
  },
  create(context) {
    const parserServices = getParserServices(context);
    const checker = parserServices.program.getTypeChecker();

    return {
      TSAsExpression(node: TSESTree.TSAsExpression) {
        // Skip `as const` — always valid
        if (
          node.typeAnnotation.type === 'TSTypeReference' &&
          node.typeAnnotation.typeName.type === 'Identifier' &&
          node.typeAnnotation.typeName.name === 'const'
        ) {
          return;
        }

        // Skip assertions to any/unknown (escape hatches)
        const assertedType = parserServices.getTypeFromTypeNode(node.typeAnnotation);
        if (
          (assertedType.flags &
            (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never)) !==
          0
        ) {
          return;
        }

        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);

        // Get the contextual type — what the surrounding context expects
        const contextualType = checker.getContextualType(tsNode);
        if (!contextualType) {
          return;
        }

        // Get the original type of the expression before the assertion
        const originalTsNode = parserServices.esTreeNodeToTSNodeMap.get(node.expression);
        const originalType = checker.getTypeAtLocation(originalTsNode);

        // If the original type is already assignable to the contextual type,
        // the narrowing assertion is unnecessary
        if (checker.isTypeAssignableTo(originalType, contextualType)) {
          context.report({
            node: node.typeAnnotation,
            messageId: 'unnecessary',
            fix(fixer) {
              // Remove everything from end of expression to end of the as-expression
              return fixer.removeRange([node.expression.range[1], node.range[1]]);
            },
          });
        }
      },
    };
  },
});

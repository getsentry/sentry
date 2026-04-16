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

    function isArgumentToGenericCall(node: TSESTree.TSAsExpression): boolean {
      // Walk up: the assertion might be inside an object literal property
      // that is an argument to a call, e.g. fn({ x: val as T })
      let current: TSESTree.Node = node;
      while (current.parent) {
        // eslint-disable-next-line @sentry/no-unnecessary-type-annotation -- breaks circular inference from `current = parent`
        const parent: TSESTree.Node = current.parent;
        if (
          parent.type === 'CallExpression' &&
          parent.arguments.includes(current as TSESTree.CallExpressionArgument)
        ) {
          // Found the call — check if it has explicit type arguments
          if (parent.typeArguments && parent.typeArguments.params.length > 0) {
            return false;
          }
          // Check if the callee has generic call signatures
          const calleeTsNode = parserServices.esTreeNodeToTSNodeMap.get(parent.callee);
          const calleeType = checker.getTypeAtLocation(calleeTsNode);
          const callSignatures = calleeType.getCallSignatures();
          return callSignatures.some(sig => {
            const typeParams = sig.getTypeParameters();
            return typeParams && typeParams.length > 0;
          });
        }
        // Keep walking through object/array literals and properties
        if (
          parent.type === 'Property' ||
          parent.type === 'ObjectExpression' ||
          parent.type === 'ArrayExpression' ||
          parent.type === 'SpreadElement'
        ) {
          current = parent;
          continue;
        }
        break;
      }
      return false;
    }

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

        // Skip double assertions like `as unknown as T` / `as any as T`
        // These are deliberate escape hatches via an intermediate widening type
        if (node.expression.type === 'TSAsExpression') {
          const innerAssertedType = parserServices.getTypeFromTypeNode(
            node.expression.typeAnnotation
          );
          if (
            (innerAssertedType.flags &
              (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never)) !==
            0
          ) {
            return;
          }
        }

        // Skip assertions that are arguments to generic function calls without
        // explicit type arguments — the assertion participates in type inference
        // for the generic, so removing it would change the inferred types.
        if (isArgumentToGenericCall(node)) {
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

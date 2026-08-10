import {ESLintUtils, type TSESTree} from '@typescript-eslint/utils';
import ts from 'typescript';

import {getTypeScriptServices} from './utils/typescript.ts';
import {createTypeAwareRuleChecks} from './typeAwareRules.ts';

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
    const typeScriptServices = getTypeScriptServices(context);
    if (!typeScriptServices) {
      return {};
    }

    const checks = createTypeAwareRuleChecks(typeScriptServices.program.getTypeChecker());

    return {
      TSAsExpression(node: TSESTree.TSAsExpression) {
        const assertion = typeScriptServices.getTsNode(node);
        if (
          !assertion ||
          !ts.isAsExpression(assertion) ||
          !checks.isUnnecessaryTypeNarrowing(assertion)
        ) {
          return;
        }

        context.report({
          node: node.typeAnnotation,
          messageId: 'unnecessary',
          fix(fixer) {
            const source = context.sourceCode.getText();
            const asIndex = source.indexOf(' as ', node.expression.range[1]);
            return asIndex === -1 ? null : fixer.removeRange([asIndex, node.range[1]]);
          },
        });
      },
    };
  },
});

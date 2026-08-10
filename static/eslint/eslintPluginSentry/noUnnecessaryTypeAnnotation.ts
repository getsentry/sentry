import {ESLintUtils} from '@typescript-eslint/utils';
import ts from 'typescript';

import {getTypeScriptServices} from './utils/typescript.ts';
import {createTypeAwareRuleChecks} from './typeAwareRules.ts';

export const noUnnecessaryTypeAnnotation = ESLintUtils.RuleCreator.withoutDocs({
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
    const typeScriptServices = getTypeScriptServices(context);
    if (!typeScriptServices) {
      return {};
    }

    const checks = createTypeAwareRuleChecks(typeScriptServices.program.getTypeChecker());

    return {
      VariableDeclarator(node) {
        const declaration = typeScriptServices.getTsNode(node);
        if (
          !declaration ||
          !ts.isVariableDeclaration(declaration) ||
          !node.id.typeAnnotation ||
          !checks.isUnnecessaryTypeAnnotation(declaration)
        ) {
          return;
        }

        context.report({
          node: node.id.typeAnnotation,
          messageId: 'unnecessary',
          fix: fixer => fixer.remove(node.id.typeAnnotation!),
        });
      },
    };
  },
});

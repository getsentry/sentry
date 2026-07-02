import {AST_NODE_TYPES, ESLintUtils} from '@typescript-eslint/utils';

export const noDigitsInTn = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: {
      description: "Disallow using '%d' within 'tn()' — use '%s' instead",
    },
    fixable: 'code',
    schema: [],
    messages: {
      noDigits: "Do not use '%d' within 'tn()'. Use '%s' instead.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== AST_NODE_TYPES.Identifier || node.callee.name !== 'tn') {
          return;
        }

        for (const argument of node.arguments) {
          if (
            argument.type === AST_NODE_TYPES.Literal &&
            typeof argument.value === 'string' &&
            argument.value.includes('%d')
          ) {
            context.report({
              node,
              messageId: 'noDigits',
              fix(fixer) {
                return fixer.replaceText(argument, argument.raw.replace(/%d/g, '%s'));
              },
            });
          }
        }
      },
    };
  },
});

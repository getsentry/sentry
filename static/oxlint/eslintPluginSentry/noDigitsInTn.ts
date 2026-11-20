import {defineRule} from '@oxlint/plugins';

export const noDigitsInTn = defineRule({
  meta: {
    type: 'suggestion',
    docs: {description: "Disallow using '%d' within 'tn()' — use '%s' instead"},
    fixable: 'code',
    schema: [],
    messages: {noDigits: "Do not use '%d' within 'tn()'. Use '%s' instead."},
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'tn') {
          return;
        }

        for (const argument of node.arguments) {
          if (
            argument.type === 'Literal' &&
            typeof argument.value === 'string' &&
            argument.value.includes('%d')
          ) {
            context.report({
              node,
              messageId: 'noDigits',
              fix(fixer) {
                return fixer.replaceText(
                  argument,
                  context.sourceCode.getText(argument).replace(/%d/g, '%s')
                );
              },
            });
          }
        }
      },
    };
  },
});

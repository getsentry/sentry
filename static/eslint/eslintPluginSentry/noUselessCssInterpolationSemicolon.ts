import {AST_NODE_TYPES, ESLintUtils, type TSESTree} from '@typescript-eslint/utils';

import {isCssTaggedTemplate, isStyledOrCssTemplate} from './utils/styled';

function isCssInterpolationExpression(node: TSESTree.Node): boolean {
  if (isCssTaggedTemplate(node)) {
    return true;
  }

  switch (node.type) {
    case AST_NODE_TYPES.ArrowFunctionExpression:
      return isCssInterpolationExpression(node.body);
    case AST_NODE_TYPES.ConditionalExpression:
      return (
        isCssInterpolationExpression(node.consequent) &&
        isCssInterpolationExpression(node.alternate)
      );
    case AST_NODE_TYPES.LogicalExpression:
      return node.operator === '&&' && isCssInterpolationExpression(node.right);
    default:
      return false;
  }
}

export const noUselessCssInterpolationSemicolon = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow no-op semicolons after css tagged template interpolations inside styled/css templates',
    },
    fixable: 'code',
    schema: [],
    messages: {
      noUselessSemicolon:
        'Remove this semicolon; it is outside the nested `css` block and does not emit CSS.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      TemplateLiteral(node) {
        if (!isStyledOrCssTemplate(node.parent) || node.parent.quasi !== node) {
          return;
        }

        node.expressions.forEach((expression, index) => {
          if (
            !node.quasis[index + 1]?.value.raw.startsWith(';') ||
            !isCssInterpolationExpression(expression)
          ) {
            return;
          }

          const closingBraceIndex = expression.range[1];
          if (
            sourceCode.text[closingBraceIndex] !== '}' ||
            sourceCode.text[closingBraceIndex + 1] !== ';'
          ) {
            return;
          }

          context.report({
            node: expression,
            messageId: 'noUselessSemicolon',
            fix(fixer) {
              return fixer.removeRange([closingBraceIndex + 1, closingBraceIndex + 2]);
            },
          });
        });
      },
    };
  },
});

import {defineRule, type ESTree} from '@oxlint/plugins';

import {isCssTaggedTemplate, isStyledOrCssTemplate} from './utils/styled.ts';

function isCssInterpolationExpression(node: ESTree.Node): boolean {
  if (isCssTaggedTemplate(node)) {
    return true;
  }

  switch (node.type) {
    case 'ArrowFunctionExpression':
      return isCssInterpolationExpression(node.body);
    case 'ConditionalExpression':
      return (
        isCssInterpolationExpression(node.consequent) &&
        isCssInterpolationExpression(node.alternate)
      );
    case 'LogicalExpression':
      return node.operator === '&&' && isCssInterpolationExpression(node.right);
    default:
      return false;
  }
}

export const noUselessCssInterpolationSemicolon = defineRule({
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
    return {
      TaggedTemplateExpression(node) {
        if (!isStyledOrCssTemplate(node)) {
          return;
        }

        const {expressions, quasis} = node.quasi;
        expressions.forEach((expression, index) => {
          const nextQuasi = quasis[index + 1];
          if (
            !nextQuasi?.value.raw.startsWith(';') ||
            !isCssInterpolationExpression(expression)
          ) {
            return;
          }

          const semicolonIndex = nextQuasi.range[0] + 1;
          context.report({
            loc: {
              start: context.sourceCode.getLocFromIndex(semicolonIndex),
              end: context.sourceCode.getLocFromIndex(semicolonIndex + 1),
            },
            messageId: 'noUselessSemicolon',
            fix(fixer) {
              return fixer.removeRange([semicolonIndex, semicolonIndex + 1]);
            },
          });
        });
      },
    };
  },
});

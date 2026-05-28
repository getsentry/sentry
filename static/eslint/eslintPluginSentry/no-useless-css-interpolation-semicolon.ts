import {AST_NODE_TYPES, ESLintUtils, type TSESTree} from '@typescript-eslint/utils';

const CSS_TAG_RE = /\bcss\s*`/;

function tagInvolvesName(node: TSESTree.Node, name: string): boolean {
  if (node.type === AST_NODE_TYPES.Identifier) {
    return node.name === name;
  }
  if (node.type === AST_NODE_TYPES.MemberExpression) {
    return tagInvolvesName(node.object, name);
  }
  if (node.type === AST_NODE_TYPES.CallExpression) {
    return tagInvolvesName(node.callee, name);
  }
  return false;
}

function isStyledOrCssTemplate(
  node: TSESTree.Node | undefined
): node is TSESTree.TaggedTemplateExpression {
  if (node?.type !== AST_NODE_TYPES.TaggedTemplateExpression) {
    return false;
  }
  const {tag} = node;
  return tagInvolvesName(tag, 'styled') || tagInvolvesName(tag, 'css');
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
            !CSS_TAG_RE.test(sourceCode.getText(expression))
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

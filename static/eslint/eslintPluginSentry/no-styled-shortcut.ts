import {AST_NODE_TYPES, ESLintUtils} from '@typescript-eslint/utils';

export const noStyledShortcut = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        "Disallow styled-components shorthand (e.g. styled.div) — use styled('div') instead",
    },
    fixable: 'code',
    schema: [],
    messages: {
      noShorthand:
        'Do not use the shorthand/member expression style of styled. Use the function call syntax instead: styled({{element}}).',
    },
  },
  create(context) {
    return {
      TaggedTemplateExpression(node) {
        const {tag} = node;
        if (
          tag.type !== AST_NODE_TYPES.MemberExpression ||
          tag.object.type !== AST_NODE_TYPES.Identifier ||
          tag.object.name !== 'styled' ||
          tag.property.type !== AST_NODE_TYPES.Identifier
        ) {
          return;
        }

        const element = tag.property.name;
        const replaceStart = tag.object.range[1];
        const replaceEnd = tag.property.range[1];

        context.report({
          node,
          messageId: 'noShorthand',
          data: {element},
          fix(fixer) {
            return fixer.replaceTextRange([replaceStart, replaceEnd], `('${element}')`);
          },
        });
      },
    };
  },
});

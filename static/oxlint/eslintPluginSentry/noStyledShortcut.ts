import {defineRule} from '@oxlint/plugins';

export const noStyledShortcut = defineRule({
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
          tag.type !== 'MemberExpression' ||
          tag.object.type !== 'Identifier' ||
          tag.object.name !== 'styled' ||
          tag.property.type !== 'Identifier'
        ) {
          return;
        }

        const element = tag.property.name;

        context.report({
          node,
          messageId: 'noShorthand',
          data: {element},
          fix(fixer) {
            return fixer.replaceText(tag, `styled('${element}')`);
          },
        });
      },
    };
  },
});

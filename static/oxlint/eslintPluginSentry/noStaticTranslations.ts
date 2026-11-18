import {defineRule} from '@oxlint/plugins';

export const noStaticTranslations = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'Require using ATTRIBUTE_SEARCH_METADATA[key].brief in td()',
    },
    schema: [],
    messages: {
      forbidden:
        'td() must use ATTRIBUTE_SEARCH_METADATA[key].brief from @sentry/conventions/attributes/search',
    },
  },

  create(context) {
    return {
      CallExpression(node) {
        const [translationArg] = node.arguments;
        if (
          node.callee.type !== 'Identifier' ||
          node.callee.name !== 'td' ||
          !translationArg
        ) {
          return;
        }

        if (
          translationArg.type === 'MemberExpression' &&
          !translationArg.computed &&
          translationArg.property.name === 'brief'
        ) {
          const object =
            translationArg.object.type === 'TSNonNullExpression'
              ? translationArg.object.expression
              : translationArg.object;
          if (
            object.type === 'MemberExpression' &&
            object.object.type === 'Identifier' &&
            object.object.name === 'ATTRIBUTE_SEARCH_METADATA'
          ) {
            return;
          }
        }

        context.report({
          node: translationArg,
          messageId: 'forbidden',
        });
      },
    };
  },
});

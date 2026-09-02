import {ESLintUtils} from '@typescript-eslint/utils';

const DYNAMIC_TRANSLATION_FNS = ['td'];

export const noStaticTranslations = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description: 'Require using ATTRIBUTE_SEARCH_METADATA[key].brief in td()',
    },
    schema: [],
    messages: {
      forbidden:
        'td() must use ATTRIBUTE_SEARCH_METADATA[key].brief from @sentry/conventions',
    },
  },

  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee?.type !== 'Identifier') {
          return;
        }
        if (!DYNAMIC_TRANSLATION_FNS.includes(callee.name)) {
          return;
        }
        if (node.arguments.length === 0) {
          return;
        }

        const translationArg = node.arguments?.[0];
        if (!translationArg) {
          return;
        }

        // Check if it's ATTRIBUTE_SEARCH_METADATA[...].brief
        if (translationArg.type === 'MemberExpression') {
          const property = translationArg.property;
          const object =
            translationArg.object.type === 'TSNonNullExpression'
              ? translationArg.object.expression
              : translationArg.object;

          // Must be accessing .brief
          if (property.type === 'Identifier' && property.name === 'brief') {
            // Object must be ATTRIBUTE_SEARCH_METADATA[...]
            if (
              object.type === 'MemberExpression' &&
              object.object.type === 'Identifier' &&
              object.object.name === 'ATTRIBUTE_SEARCH_METADATA'
            ) {
              return; // Valid pattern
            }
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

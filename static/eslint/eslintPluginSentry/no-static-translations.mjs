const DYNAMIC_TRANSLATION_FNS = ['td'];

/**
 * @type {import('eslint').Rule.RuleModule}
 */
const noStaticTranslations = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require using ATTRIBUTE_METADATA[key].brief pattern in td()',
      recommended: true,
    },
    schema: [],
    messages: {
      forbidden: 'td() must use ATTRIBUTE_METADATA[key].brief from @sentry/conventions',
    },
  },

  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (!callee || callee.type !== 'Identifier') return;
        if (!DYNAMIC_TRANSLATION_FNS.includes(callee.name)) return;
        if (node.arguments.length === 0) return;

        const translationArg = node.arguments?.[0];
        if (!translationArg) return;

        // Check if it's ATTRIBUTE_METADATA[...].brief
        if (translationArg.type === 'MemberExpression') {
          const property = translationArg.property;
          const object = translationArg.object;

          // Must be accessing .brief
          if (property.type === 'Identifier' && property.name === 'brief') {
            // Object must be ATTRIBUTE_METADATA[...]
            if (
              object.type === 'MemberExpression' &&
              object.object.type === 'Identifier' &&
              object.object.name === 'ATTRIBUTE_METADATA'
            ) {
              return; // Valid pattern
            }
          }
        }

        context.report({
          node: translationArg,
          message: 'td() must use ATTRIBUTE_METADATA[key].brief from @sentry/conventions',
        });
      },
    };
  },
};

export default noStaticTranslations;

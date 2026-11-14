import {defineRule} from '@oxlint/plugins';

export const noQueryDataTypeParameters = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow explicit type parameters on queryClient.getQueryData and queryClient.setQueryData',
    },
    schema: [],
    messages: {
      noTypeParameters:
        'Do not pass explicit type parameters to {{method}}. Use apiOptions or queryOptions — they infer the correct type from the query key.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const {callee} = node;
        if (
          !node.typeArguments ||
          callee.type !== 'MemberExpression' ||
          callee.computed ||
          callee.property.type !== 'Identifier'
        ) {
          return;
        }
        const method = callee.property.name;
        if (method !== 'getQueryData' && method !== 'setQueryData') {
          return;
        }
        context.report({
          node: node.typeArguments,
          messageId: 'noTypeParameters',
          data: {method},
        });
      },
    };
  },
});

import {AST_NODE_TYPES, ESLintUtils} from '@typescript-eslint/utils';

export const noQueryDataTypeParameters = ESLintUtils.RuleCreator.withoutDocs({
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
        if (!node.typeArguments || node.typeArguments.params.length === 0) {
          return;
        }
        const {callee} = node;
        if (
          callee.type !== AST_NODE_TYPES.MemberExpression ||
          callee.property.type !== AST_NODE_TYPES.Identifier
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

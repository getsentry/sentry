import {ESLintUtils, type TSESTree} from '@typescript-eslint/utils';

const PASCAL_CASE = /^_*[A-Z][a-zA-Z0-9]*$/u;
const UPPER_CASE = /^[A-Z][A-Z0-9_]*$/u;

export const namingConvention = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require PascalCase type-like names and UPPER_CASE enum member names',
    },
    schema: [],
    messages: {
      typeLike: 'Type-like names must use PascalCase.',
      enumMember: 'Enum member names must use UPPER_CASE.',
    },
  },
  create(context) {
    function checkTypeLike(node: TSESTree.Identifier | null | undefined): void {
      if (node && !PASCAL_CASE.test(node.name)) {
        context.report({node, messageId: 'typeLike'});
      }
    }

    return {
      ClassDeclaration(node) {
        checkTypeLike(node.id);
      },
      ClassExpression(node) {
        checkTypeLike(node.id);
      },
      TSEnumDeclaration(node) {
        checkTypeLike(node.id);
      },
      TSEnumMember(node) {
        const name =
          node.id.type === 'Identifier'
            ? node.id.name
            : typeof node.id.value === 'string'
              ? node.id.value
              : undefined;
        if (name !== undefined && !UPPER_CASE.test(name)) {
          context.report({node: node.id, messageId: 'enumMember'});
        }
      },
      TSInterfaceDeclaration(node) {
        checkTypeLike(node.id);
      },
      TSTypeAliasDeclaration(node) {
        checkTypeLike(node.id);
      },
      TSTypeParameter(node) {
        checkTypeLike(node.name);
      },
    };
  },
});

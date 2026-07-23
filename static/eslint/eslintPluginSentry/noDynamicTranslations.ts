import {AST_NODE_TYPES, ESLintUtils, type TSESTree} from '@typescript-eslint/utils';

const TRANSLATION_FNS = ['t', 'tn', 'tct'];

export const noDynamicTranslations = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow non-literal strings in t(), tn(), and tct()',
    },
    schema: [],
    messages: {
      interpolation:
        'Dynamic value interpolation cannot be used in translation functions. Use a parameterized string literal instead.',
      dynamic:
        '{{fnName}}() cannot be used to translate dynamic values. Use a parameterized string literal instead.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type !== AST_NODE_TYPES.Identifier ||
          !TRANSLATION_FNS.includes(node.callee.name)
        ) {
          return;
        }

        if (node.arguments.length === 0) {
          return;
        }

        const fnName = node.callee.name;

        function checkTranslationArg(arg: TSESTree.CallExpressionArgument) {
          if (arg.type === AST_NODE_TYPES.TemplateLiteral) {
            if (arg.expressions.length === 0) {
              return;
            }
            context.report({node: arg, messageId: 'interpolation'});
            return;
          }

          if (arg.type !== AST_NODE_TYPES.Literal) {
            context.report({node: arg, messageId: 'dynamic', data: {fnName}});
          }
        }

        checkTranslationArg(node.arguments[0]!);

        if (fnName === 'tn' && node.arguments.length > 1) {
          checkTranslationArg(node.arguments[1]!);
        }
      },
    };
  },
});

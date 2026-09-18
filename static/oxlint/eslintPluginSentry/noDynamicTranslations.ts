import {defineRule, type ESTree} from '@oxlint/plugins';

const TRANSLATION_FNS = ['t', 'tn', 'tct'];

export const noDynamicTranslations = defineRule({
  meta: {
    type: 'problem',
    docs: {description: 'Disallow non-literal strings in t(), tn(), and tct()'},
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
          node.callee.type !== 'Identifier' ||
          !TRANSLATION_FNS.includes(node.callee.name)
        ) {
          return;
        }

        if (node.arguments.length === 0) {
          return;
        }

        const fnName = node.callee.name;

        function checkTranslationArg(arg: ESTree.Argument) {
          if (arg.type === 'TemplateLiteral') {
            if (arg.expressions.length === 0) {
              return;
            }
            context.report({node: arg, messageId: 'interpolation'});
            return;
          }

          if (arg.type !== 'Literal') {
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

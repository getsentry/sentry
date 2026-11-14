import {defineRule, type ESTree} from '@oxlint/plugins';

type StyleExpression = ESTree.Expression | ESTree.SpreadElement | null;

function isEmotionStyleFunction(node: ESTree.Expression): boolean {
  return (
    (node.type === 'Identifier' && node.name === 'css') ||
    (node.type === 'MemberExpression' &&
      node.object.type === 'Identifier' &&
      node.object.name === 'styled') ||
    (node.type === 'CallExpression' &&
      node.callee.type === 'Identifier' &&
      node.callee.name === 'styled')
  );
}

export const noVanillaEmotion = defineRule({
  meta: {
    type: 'problem',
    docs: {description: 'Disallow vanilla Emotion'},
    schema: [],
    messages: {vanillaEmotion: 'Vanilla emotion should not be used.'},
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value === '@emotion/css') {
          context.report({node: node.source, messageId: 'vanillaEmotion'});
        }
      },
    };
  },
});

export const emotionStyledImport = defineRule({
  meta: {
    type: 'problem',
    docs: {description: 'Require styled to be imported from @emotion/styled'},
    fixable: 'code',
    schema: [],
    messages: {incorrectImport: 'styled should be imported from @emotion/styled.'},
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'react-emotion') {
          return;
        }

        context.report({
          node: node.source,
          messageId: 'incorrectImport',
          fix:
            node.specifiers.length === 1 &&
            node.specifiers[0]?.type === 'ImportDefaultSpecifier'
              ? fixer => fixer.replaceText(node.source, "'@emotion/styled'")
              : undefined,
        });
      },
    };
  },
});

export const emotionSyntaxPreference = defineRule({
  meta: {
    type: 'problem',
    docs: {description: 'Choose between string and object Emotion syntax'},
    schema: [{type: 'string', enum: ['string', 'object']}],
    messages: {
      emptyCssProp: 'Empty `css` prop is not valid.',
      preferObjectStyle: 'Styles should be written using objects.',
      preferStringStyle: 'Styles should be written using strings.',
      preferWrappingWithCSS: 'Prefer wrapping your string styles with `css` call.',
    },
  },
  create(context) {
    const preference = context.options[0];

    function checkStyle(node: StyleExpression): void {
      if (node?.type === 'ArrayExpression') {
        for (const element of node.elements) {
          checkStyle(element);
        }
      } else if (preference === 'string') {
        if (node?.type === 'ObjectExpression') {
          context.report({node, messageId: 'preferStringStyle'});
        } else if (node?.type === 'Literal' && typeof node.value === 'string') {
          context.report({node, messageId: 'preferWrappingWithCSS'});
        }
      } else if (
        preference === 'object' &&
        (node?.type === 'TemplateLiteral' ||
          (node?.type === 'Literal' && typeof node.value === 'string'))
      ) {
        context.report({node, messageId: 'preferObjectStyle'});
      }
    }

    return {
      TaggedTemplateExpression(node) {
        if (preference === 'object' && isEmotionStyleFunction(node.tag)) {
          context.report({node, messageId: 'preferObjectStyle'});
        }
      },
      CallExpression(node) {
        if (isEmotionStyleFunction(node.callee)) {
          node.arguments.forEach(checkStyle);
        }
      },
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'css') {
          return;
        }
        if (!node.value) {
          context.report({node, messageId: 'emptyCssProp'});
          return;
        }

        checkStyle(
          node.value.type === 'JSXExpressionContainer'
            ? node.value.expression.type === 'JSXEmptyExpression'
              ? null
              : node.value.expression
            : node.value
        );
      },
    };
  },
});

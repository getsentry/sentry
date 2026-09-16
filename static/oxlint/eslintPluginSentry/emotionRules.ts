import {defineRule, type ESTree} from '@oxlint/plugins';

type StyleExpression = ESTree.Expression | ESTree.SpreadElement | null;

function isStringStyle(node: ESTree.TaggedTemplateExpression): boolean {
  const {tag} = node;
  return (
    (tag.type === 'Identifier' && tag.name === 'css') ||
    (tag.type === 'MemberExpression' &&
      tag.object.type === 'Identifier' &&
      tag.object.name === 'styled') ||
    (tag.type === 'CallExpression' &&
      tag.callee.type === 'Identifier' &&
      tag.callee.name === 'styled')
  );
}

function isObjectStyle(node: ESTree.CallExpression): boolean {
  const {callee} = node;
  return (
    (callee.type === 'Identifier' && callee.name === 'css') ||
    (callee.type === 'MemberExpression' &&
      callee.object.type === 'Identifier' &&
      callee.object.name === 'styled') ||
    (callee.type === 'CallExpression' &&
      callee.callee.type === 'Identifier' &&
      callee.callee.name === 'styled')
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

    function checkPreferringString(node: StyleExpression): void {
      if (!node) {
        return;
      }
      if (node.type === 'ArrayExpression') {
        for (const element of node.elements) {
          checkPreferringString(element);
        }
      } else if (node.type === 'ObjectExpression') {
        context.report({node, messageId: 'preferStringStyle'});
      } else if (node.type === 'Literal' && typeof node.value === 'string') {
        context.report({node, messageId: 'preferWrappingWithCSS'});
      }
    }

    function checkPreferringObject(node: StyleExpression): void {
      if (!node) {
        return;
      }
      if (node.type === 'ArrayExpression') {
        for (const element of node.elements) {
          checkPreferringObject(element);
        }
      } else if (node.type === 'TemplateLiteral') {
        context.report({node, messageId: 'preferObjectStyle'});
      } else if (node.type === 'Literal' && typeof node.value === 'string') {
        context.report({node, messageId: 'preferObjectStyle'});
      }
    }

    return {
      TaggedTemplateExpression(node) {
        if (preference === 'object' && isStringStyle(node)) {
          context.report({node, messageId: 'preferObjectStyle'});
        }
      },
      CallExpression(node) {
        if (!isObjectStyle(node)) {
          return;
        }
        for (const argument of node.arguments) {
          if (argument.type !== 'SpreadElement') {
            if (preference === 'string') {
              checkPreferringString(argument);
            } else if (preference === 'object') {
              checkPreferringObject(argument);
            }
          }
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

        const expression =
          node.value.type === 'JSXExpressionContainer'
            ? node.value.expression.type === 'JSXEmptyExpression'
              ? null
              : node.value.expression
            : node.value;
        if (preference === 'string') {
          checkPreferringString(expression);
        } else if (preference === 'object') {
          checkPreferringObject(expression);
        }
      },
    };
  },
});

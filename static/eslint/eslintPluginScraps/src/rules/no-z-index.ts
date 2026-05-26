/**
 * ESLint rule: no-z-index
 *
 * Bans z-index CSS declarations and zIndex props/style properties.
 * The only allowed value is z-index: 1 / zIndex: 1 (local override within a Layer).
 *
 * Use the Layer primitive for stacking context isolation instead.
 */
import type {TSESTree} from '@typescript-eslint/utils';
import {ESLintUtils} from '@typescript-eslint/utils';

const MESSAGE =
  'Avoid z-index. Use the Layer primitive for stacking context isolation, or z-index: 1 for local overrides within a Layer.';

/**
 * Matches `z-index: <value>` in CSS text, capturing the value.
 * Handles multiline, whitespace variations, and !important.
 */
const Z_INDEX_CSS_RE = /z-index\s*:\s*([^;}\n]+)/gi;

/**
 * Returns true if the CSS value is exactly `1` (possibly with !important).
 */
function isAllowedCssValue(raw: string): boolean {
  const trimmed = raw.replace(/!important/gi, '').trim();
  return trimmed === '1';
}

/**
 * Returns true if a JS/TS expression node represents the numeric literal 1.
 */
function isNumericLiteralOne(node: TSESTree.Node): boolean {
  return node.type === 'Literal' && node.value === 1;
}

export const noZIndex = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow z-index CSS declarations and zIndex props/style properties. Use the Layer primitive instead.',
    },
    schema: [],
    messages: {
      noZIndex: MESSAGE,
    },
  },
  create(context) {
    return {
      // 1. CSS `z-index` in tagged template literals (styled components, css``)
      TaggedTemplateExpression(node: TSESTree.TaggedTemplateExpression) {
        for (const quasi of node.quasi.quasis) {
          const text = quasi.value.raw;
          const matches = text.matchAll(Z_INDEX_CSS_RE);

          for (const match of matches) {
            const value = match[1] ?? '';
            if (isAllowedCssValue(value)) {
              continue;
            }
            context.report({
              node: quasi,
              messageId: 'noZIndex',
            });
          }
        }
      },

      // 2. `zIndex` key in object expressions (style objects, css() calls)
      // 3. `zIndex` prop on JSX elements
      Property(node: TSESTree.Property) {
        if (
          node.key.type === 'Identifier' &&
          node.key.name === 'zIndex' &&
          !isNumericLiteralOne(node.value)
        ) {
          context.report({
            node,
            messageId: 'noZIndex',
          });
        }
      },

      // zIndex as a JSX attribute (e.g. <Foo zIndex={10} />)
      JSXAttribute(node: TSESTree.JSXAttribute) {
        if (node.name.type === 'JSXIdentifier' && node.name.name === 'zIndex') {
          // Allow zIndex={1}
          if (
            node.value?.type === 'JSXExpressionContainer' &&
            isNumericLiteralOne(node.value.expression)
          ) {
            return;
          }
          context.report({
            node,
            messageId: 'noZIndex',
          });
        }
      },
    };
  },
});

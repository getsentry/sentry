import {AST_NODE_TYPES, ESLintUtils} from '@typescript-eslint/utils';
import type {TSESTree} from '@typescript-eslint/utils';

import {isStyledOrCssTemplate} from './utils/styled';

const CSS_DECLARATION_RE = /[\w-]+\s*:\s*[^;]+;/;

function isInsideStyledOrCssTemplate(node: TSESTree.Node): boolean {
  let current = node.parent;
  while (current) {
    if (isStyledOrCssTemplate(current)) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function looksLikeCssDeclarations(text: string): boolean {
  return CSS_DECLARATION_RE.test(text);
}

export const noRawCssInStyled = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow raw template literals containing CSS inside styled/css tagged templates — use the css tag instead',
    },
    fixable: 'code',
    schema: [],
    messages: {
      useCssTag:
        'Use the `css` tagged template literal instead of a raw template literal for CSS inside styled components.',
    },
  },
  create(context) {
    return {
      TemplateLiteral(node) {
        if (
          node.parent?.type === AST_NODE_TYPES.TaggedTemplateExpression &&
          node.parent.quasi === node
        ) {
          return;
        }

        if (!isInsideStyledOrCssTemplate(node)) {
          return;
        }

        const raw = node.quasis.map(q => q.value.raw).join('__EXPR__');
        if (!looksLikeCssDeclarations(raw)) {
          return;
        }

        context.report({
          node,
          messageId: 'useCssTag',
          fix(fixer) {
            return fixer.insertTextBefore(node, 'css');
          },
        });
      },
    };
  },
});

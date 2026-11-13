import {defineRule, type ESTree, type Scope} from '@oxlint/plugins';

import {isStyledOrCssTemplate} from './utils/styled.ts';

const CSS_DECLARATION_RE = /[\w-]+\s*:\s*[^;]+;/;

function isInsideStyledOrCssTemplate(node: ESTree.Node): boolean {
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

export const noRawCssInStyled = defineRule({
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
    function isCssInScope(node: ESTree.Node): boolean {
      let scope: Scope | null = context.sourceCode.getScope(node);
      while (scope) {
        if (scope.set.has('css')) {
          return true;
        }
        scope = scope.upper;
      }
      return false;
    }

    return {
      TemplateLiteral(node) {
        if (node.parent?.type === 'TaggedTemplateExpression') {
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
          fix: isCssInScope(node)
            ? fixer => fixer.insertTextBefore(node, 'css')
            : undefined,
        });
      },
    };
  },
});

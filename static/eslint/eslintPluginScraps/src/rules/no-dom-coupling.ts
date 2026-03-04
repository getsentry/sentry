/**
 * ESLint rule: no-dom-coupling
 *
 * Disallows CSS in styled(Component) that reaches into the component's
 * internal DOM structure via nested selectors, class selectors, or child
 * combinators. This creates fragile coupling to implementation details.
 */
import {AST_NODE_TYPES, ESLintUtils} from '@typescript-eslint/utils';
import type {TSESTree} from '@typescript-eslint/utils';

import {getStyledInfo} from '../ast/utils/styled';

const HTML_ELEMENTS = new Set([
  'a',
  'abbr',
  'address',
  'area',
  'article',
  'aside',
  'audio',
  'b',
  'blockquote',
  'br',
  'button',
  'canvas',
  'caption',
  'code',
  'col',
  'colgroup',
  'dd',
  'del',
  'details',
  'dfn',
  'dialog',
  'div',
  'dl',
  'dt',
  'em',
  'embed',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'i',
  'iframe',
  'img',
  'input',
  'ins',
  'kbd',
  'label',
  'legend',
  'li',
  'link',
  'main',
  'map',
  'mark',
  'menu',
  'meter',
  'nav',
  'object',
  'ol',
  'optgroup',
  'option',
  'output',
  'p',
  'picture',
  'pre',
  'progress',
  'q',
  's',
  'samp',
  'section',
  'select',
  'slot',
  'small',
  'source',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'svg',
  'table',
  'tbody',
  'td',
  'textarea',
  'tfoot',
  'th',
  'thead',
  'time',
  'tr',
  'u',
  'ul',
  'var',
  'video',
]);

interface SelectorViolation {
  selector: string;
}

function findNestedSelectors(cssText: string): SelectorViolation[] {
  const violations: SelectorViolation[] = [];
  const lines = cssText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
      continue;
    }

    // Skip @-rules
    if (trimmed.startsWith('@')) {
      continue;
    }

    // Pattern 1: Child/descendant combinator with HTML element
    // Matches: > div, & span, & > div
    // Excludes: &:hover, &::before, &.className
    const childMatch = trimmed.match(/(?:&\s*>?\s*|>\s*)([a-z][a-z0-9]*)\b/);
    if (childMatch && HTML_ELEMENTS.has(childMatch[1]!)) {
      violations.push({selector: (trimmed.split('{')[0] ?? trimmed).trim()});
      continue;
    }

    // Pattern 2: Bare HTML element as selector at start of line
    // Matches: input {, button,
    // Does NOT match: color: red; (no { after word)
    const bareMatch = trimmed.match(/^([a-z][a-z0-9]*)\s*[{,>+~]/);
    if (bareMatch && HTML_ELEMENTS.has(bareMatch[1]!)) {
      violations.push({selector: (trimmed.split('{')[0] ?? trimmed).trim()});
      continue;
    }

    // Pattern 3: Standalone class selector (not &.class which styles root)
    // Matches: .loading {, .pill-icon {
    // Does NOT match: &.active {
    if (/^\.[a-zA-Z_-][\w-]*\s*[{,]/.test(trimmed)) {
      violations.push({selector: (trimmed.split('{')[0] ?? trimmed).trim()});
      continue;
    }

    // Pattern 4: Class selector after combinator
    // Matches: > .class {, + .class {
    if (/[> +~]\s*\.[a-zA-Z_-][\w-]*\s*[{,]/.test(trimmed) && !trimmed.startsWith('&.')) {
      violations.push({selector: (trimmed.split('{')[0] ?? trimmed).trim()});
      continue;
    }

    // Pattern 5: Universal child selector > *
    if (/>\s*\*/.test(trimmed) && !trimmed.startsWith('/*')) {
      violations.push({selector: (trimmed.split('{')[0] ?? trimmed).trim()});
      continue;
    }
  }

  return violations;
}

export const noDomCoupling = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow CSS in styled(Component) that reaches into internal DOM structure.',
    },
    schema: [],
    messages: {
      nestedSelector:
        'styled({{component}}) contains CSS that couples to internal DOM: "{{selector}}". Prefer using component props or composition instead.',
    },
  },

  create(context) {
    return {
      TaggedTemplateExpression(node: TSESTree.TaggedTemplateExpression) {
        const tagInfo = getStyledInfo(node.tag);
        if (tagInfo?.kind !== 'component') {
          return;
        }
        const componentName = tagInfo.name;

        const {quasi} = node;

        // Check each quasi string part for nested selectors
        for (const quasiElement of quasi.quasis) {
          const cssText = quasiElement.value.cooked ?? quasiElement.value.raw;
          if (!cssText) {
            continue;
          }

          const violations = findNestedSelectors(cssText);
          if (violations.length > 0) {
            context.report({
              node: quasiElement,
              messageId: 'nestedSelector',
              data: {
                component: componentName,
                selector: violations[0]?.selector,
              },
            });
          }
        }

        // Check interpolated expressions used as CSS selectors
        for (let i = 0; i < quasi.expressions.length; i++) {
          const expr = quasi.expressions[i];
          const precedingQuasi = quasi.quasis[i];
          const followingQuasi = quasi.quasis[i + 1];

          if (!followingQuasi || !precedingQuasi) {
            continue;
          }

          const afterText = followingQuasi.value.cooked ?? followingQuasi.value.raw;
          const beforeText = precedingQuasi.value.cooked ?? precedingQuasi.value.raw;

          // Interpolation is used as a selector if:
          // - text after starts with whitespace then { or combinator
          // - text before ends in a selector context (after {, ;, }, or newline)
          const isUsedAsSelector = /^\s*[{> +~,]/.test(afterText);
          const endsLikeSelector = /(?:^|[{;}\n])\s*$/.test(beforeText);

          if (
            isUsedAsSelector &&
            endsLikeSelector &&
            expr?.type === AST_NODE_TYPES.Identifier &&
            /^[A-Z]/.test(expr.name)
          ) {
            context.report({
              node: expr,
              messageId: 'nestedSelector',
              data: {
                component: componentName,
                selector: `\${${expr.name}}`,
              },
            });
          }
        }
      },
    };
  },
});

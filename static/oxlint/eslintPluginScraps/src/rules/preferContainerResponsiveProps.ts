import {defineRule, type ESTree} from '@oxlint/plugins';

import {parseCssTemplate, type ParsedCssAtRule} from '../ast/extractor/css.ts';
import {createImportTracker} from '../ast/tracker/imports.ts';
import {getStyledCallInfo} from '../ast/utils/styled.ts';

const STYLE_QUERY = /@(?:media|container)\b/g;
const WIDTH_QUERY = /(?:min-|max-)?width\s*[:<>=]/;
const LAYOUT_MEDIA_FEATURE = /\b(?:width|height|aspect-ratio|orientation)\b/;
const NON_LAYOUT_MEDIA_FEATURE =
  /\b(?:prefers-[\w-]+|hover|pointer|forced-colors|color-gamut|dynamic-range|resolution|print)\b/;

function isNonLayoutMediaQuery(text: string): boolean {
  const condition = text.match(/^@media\b([^{}]*)/i)?.[1];
  return Boolean(
    condition &&
    !LAYOUT_MEDIA_FEATURE.test(condition) &&
    NON_LAYOUT_MEDIA_FEATURE.test(condition)
  );
}

function enclosingStyleName(node: ESTree.Node): string | undefined {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
      return parent.id.name;
    }
    if (parent.type === 'FunctionDeclaration') {
      return parent.id?.name;
    }
  }
  return undefined;
}

function hasOnlyAllowedMediaDeclarations(
  node: ESTree.TaggedTemplateExpression,
  property: RegExp,
  allowDynamicBody = false
): boolean {
  const css = node.quasi.quasis
    .map(quasi => quasi.value.raw)
    .join('VALUE')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const queries = [...css.matchAll(/@media\b[^{}]*\{([^{}]*)\}/g)];
  if (queries.length === 0 || queries.length !== [...css.matchAll(/@media\b/g)].length) {
    return false;
  }
  return queries.every(query => {
    if (isNonLayoutMediaQuery(query[0])) {
      return true;
    }
    const declarations = (query[1] ?? '')
      .split(';')
      .map(declaration => declaration.trim())
      .filter(Boolean);
    return (
      declarations.length > 0 &&
      declarations.every(
        declaration =>
          property.test(declaration) || (allowDynamicBody && declaration === 'VALUE')
      )
    );
  });
}

function allowsViewportSizing(
  node: ESTree.TaggedTemplateExpression,
  filename: string
): boolean {
  const name = enclosingStyleName(node);
  if (
    name === 'modalCss' ||
    (filename.endsWith('/static/gsApp/actionCreators/modal.tsx') &&
      name === 'onDemandBudgetEditModalCss')
  ) {
    return hasOnlyAllowedMediaDeclarations(
      node,
      /^(?:(?:min|max)-)?(?:width|height)\s*:/
    );
  }
  if (
    filename.endsWith('/static/app/components/core/drawer/components.tsx') &&
    (name === 'DrawerContainer' || name === 'DrawerSlidePanel')
  ) {
    return hasOnlyAllowedMediaDeclarations(
      node,
      /^(?:overflow-x|pointer-events|top|right|bottom|left|border|box-shadow|overscroll-behavior-x|(?:(?:min|max)-)?(?:width|height))\s*:/
    );
  }
  return (
    filename.endsWith('/static/app/components/core/slideOverPanel/slideOverPanel.tsx') &&
    name === '_SlideOverPanel' &&
    hasOnlyAllowedMediaDeclarations(
      node,
      /^(?:position|top|right|bottom|left|(?:(?:min|max)-)?(?:width|height))\s*:/,
      true
    )
  );
}

export const preferContainerResponsiveProps = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent new media and container queries in components',
    },
    schema: [],
    messages: {
      forbidden:
        'Use container responsive props instead of viewport breakpoints or layout CSS queries. Modal and drawer sizing and non-layout media features may use @media.',
    },
  },
  create(context) {
    const importTracker = createImportTracker(context);

    return {
      ...importTracker.visitors,
      TaggedTemplateExpression(node) {
        if (!getStyledCallInfo(node, importTracker)) {
          return;
        }
        const atRules: ParsedCssAtRule[] = [];
        parseCssTemplate(node.quasi, context.sourceCode.getText(node.quasi), atRules);
        for (const atRule of atRules) {
          if (
            atRule.name === 'container' ||
            (atRule.name === 'media' &&
              !isNonLayoutMediaQuery(`@media ${atRule.params}`) &&
              !allowsViewportSizing(node, context.filename))
          ) {
            context.report({node, messageId: 'forbidden'});
          }
        }
      },
      CallExpression(node) {
        if (!importTracker.is(node.callee, '@sentry/scraps/useMedia', 'useMedia')) {
          return;
        }
        const query = node.arguments[0];
        const text =
          query?.type === 'Literal' && typeof query.value === 'string'
            ? query.value
            : query?.type === 'TemplateLiteral'
              ? query.quasis.map(quasi => quasi.value.raw).join(' ')
              : undefined;
        if (text && WIDTH_QUERY.test(text)) {
          context.report({node, messageId: 'forbidden'});
        }
      },
      Property(node) {
        const key = node.key;
        const keyName =
          key.type === 'Literal' && typeof key.value === 'string'
            ? key.value
            : key.type === 'Identifier'
              ? key.name
              : undefined;
        if (
          keyName?.startsWith('screen:') &&
          !context.filename.includes('/static/packages/') &&
          !context.filename.includes('/static/oxlint/')
        ) {
          context.report({node: key, messageId: 'forbidden'});
          return;
        }
        const query = keyName?.match(STYLE_QUERY)?.[0];
        if (
          query &&
          keyName &&
          (query === '@container' || !isNonLayoutMediaQuery(keyName))
        ) {
          context.report({node: key, messageId: 'forbidden'});
        }
      },
    };
  },
});

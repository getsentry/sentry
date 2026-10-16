import {defineRule, type ESTree} from '@oxlint/plugins';

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
    const declarations = query[1]!
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
  if (name === 'modalCss') {
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
        'Use primitive responsive props instead of layout CSS queries. Modal and drawer sizing and non-layout media features may use @media.',
    },
  },
  create(context) {
    const mediaHooks = new Set<string>();
    const emotionTags = new Set<string>();

    return {
      ImportDeclaration(node) {
        for (const specifier of node.specifiers) {
          if (
            specifier.type === 'ImportSpecifier' &&
            specifier.local.type === 'Identifier'
          ) {
            if (
              node.source.value === 'sentry/utils/useMedia' &&
              specifier.imported.type === 'Identifier' &&
              specifier.imported.name === 'useMedia'
            ) {
              mediaHooks.add(specifier.local.name);
            }
            if (
              node.source.value === '@emotion/react' &&
              specifier.imported.type === 'Identifier' &&
              specifier.imported.name === 'css'
            ) {
              emotionTags.add(specifier.local.name);
            }
          }
          if (
            node.source.value === '@emotion/styled' &&
            specifier.type === 'ImportDefaultSpecifier'
          ) {
            emotionTags.add(specifier.local.name);
          }
        }
      },
      TaggedTemplateExpression(node) {
        const tag = node.tag;
        const isEmotionTag =
          (tag.type === 'Identifier' && emotionTags.has(tag.name)) ||
          (tag.type === 'MemberExpression' &&
            tag.object.type === 'Identifier' &&
            emotionTags.has(tag.object.name)) ||
          (tag.type === 'CallExpression' &&
            tag.callee.type === 'Identifier' &&
            emotionTags.has(tag.callee.name));
        if (!isEmotionTag) {
          return;
        }
        for (const quasi of node.quasi.quasis) {
          for (const match of quasi.value.raw.matchAll(STYLE_QUERY)) {
            if (
              match[0] === '@container' ||
              (!isNonLayoutMediaQuery(quasi.value.raw.slice(match.index)) &&
                !allowsViewportSizing(node, context.filename))
            ) {
              context.report({node: quasi, messageId: 'forbidden'});
            }
          }
        }
      },
      CallExpression(node) {
        if (node.callee.type !== 'Identifier' || !mediaHooks.has(node.callee.name)) {
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
        const query = keyName?.match(STYLE_QUERY)?.[0];
        if (query && (query === '@container' || !isNonLayoutMediaQuery(keyName!))) {
          context.report({node: key, messageId: 'forbidden'});
        }
      },
    };
  },
});

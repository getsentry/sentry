import {defineRule, type ESTree} from '@oxlint/plugins';

const STYLE_QUERY = /@(?:media|container)\b/;
const WIDTH_QUERY = /(?:min-|max-)?width\s*[:<>=]/;

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

function allowsViewportSizing(node: ESTree.Node, filename: string): boolean {
  const name = enclosingStyleName(node);
  if (filename.endsWith('/static/app/components/core/drawer/components.tsx')) {
    return name === 'DrawerContainer' || name === 'DrawerSlidePanel';
  }
  return (
    filename.endsWith('/static/app/components/core/slideOverPanel/slideOverPanel.tsx') &&
    name === '_SlideOverPanel'
  );
}

function isModalSizingQuery(node: ESTree.TaggedTemplateExpression): boolean {
  if (enclosingStyleName(node) !== 'modalCss') {
    return false;
  }
  const css = node.quasi.quasis.map(quasi => quasi.value.raw).join('VALUE');
  const queries = [...css.matchAll(/@media\b[^{}]*\{([^{}]*)\}/g)];
  if (queries.length === 0 || queries.length !== [...css.matchAll(/@media\b/g)].length) {
    return false;
  }
  return queries.every(query => {
    const declarations = query[1]!
      .split(';')
      .map(declaration => declaration.trim())
      .filter(Boolean);
    return (
      declarations.length > 0 &&
      declarations.every(declaration =>
        /^(?:(?:min|max)-)?(?:width|height)\s*:/.test(declaration)
      )
    );
  });
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
        'Use primitive responsive props instead of CSS queries. Viewport sizing for modal and drawer shells may use @media.',
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
          const hasMedia = /@media\b/.test(quasi.value.raw);
          const hasContainer = /@container\b/.test(quasi.value.raw);
          if (
            hasContainer ||
            (hasMedia &&
              !allowsViewportSizing(node, context.filename) &&
              !isModalSizingQuery(node))
          ) {
            context.report({node: quasi, messageId: 'forbidden'});
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
        if (
          query &&
          (query === '@container' || !allowsViewportSizing(node, context.filename))
        ) {
          context.report({node: key, messageId: 'forbidden'});
        }
      },
    };
  },
});

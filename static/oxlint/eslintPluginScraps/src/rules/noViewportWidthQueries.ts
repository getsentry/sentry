import {defineRule, type ESTree} from '@oxlint/plugins';

const WIDTH_QUERY =
  /@(?:media|container)[^{;]+\b(?:min-width|max-width|width)\s*(?::|[<>]=?)/g;
const WIDTH_FEATURE = /\b(?:min-width|max-width|width)\s*(?::|[<>]=?)/;

function isModalCss(node: ESTree.Node): boolean {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
      if (/modalCss$/i.test(parent.id.name)) {
        return true;
      }
    }
    if (
      parent.type === 'FunctionDeclaration' &&
      /modalCss$/i.test(parent.id?.name ?? '')
    ) {
      return true;
    }
  }
  return false;
}

export const noViewportWidthQueries = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'Prefer responsive primitives for width-dependent component layout',
    },
    schema: [],
    messages: {
      forbidden:
        'Use responsive primitive props for width-dependent layout. Reserve handwritten container queries for CSS that props cannot express.',
    },
  },
  create(context) {
    // Drawer positioning and sizing intentionally track the viewport.
    if (
      /(?:^|\/)(?:\w*drawer\w*|slideOverPanel)(?:\/|\.[jt]sx?$)/i.test(context.filename)
    ) {
      return {};
    }

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
        if (isModalCss(node)) {
          return;
        }
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
          if (WIDTH_QUERY.test(quasi.value.raw)) {
            context.report({node: quasi, messageId: 'forbidden'});
          }
          WIDTH_QUERY.lastIndex = 0;
        }
      },
      CallExpression(node) {
        if (
          node.callee.type !== 'Identifier' ||
          !mediaHooks.has(node.callee.name) ||
          isModalCss(node)
        ) {
          return;
        }
        const query = node.arguments[0];
        if (
          query?.type === 'Literal' &&
          typeof query.value === 'string' &&
          WIDTH_FEATURE.test(query.value)
        ) {
          context.report({node, messageId: 'forbidden'});
        } else if (
          query?.type === 'TemplateLiteral' &&
          query.quasis.some(quasi => WIDTH_FEATURE.test(quasi.value.raw))
        ) {
          context.report({node, messageId: 'forbidden'});
        }
      },
      Property(node) {
        if (isModalCss(node)) {
          return;
        }
        const key = node.key;
        const keyName =
          key.type === 'Literal' && typeof key.value === 'string'
            ? key.value
            : key.type === 'Identifier'
              ? key.name
              : undefined;
        if (
          keyName &&
          /@(?:media|container)[^{;]+\b(?:min-width|max-width|width)\s*(?::|[<>]=?)/.test(
            keyName
          )
        ) {
          context.report({node: key, messageId: 'forbidden'});
          return;
        }
        if (keyName && /^screen:(?:2xs|xs|sm|md|lg|xl|2xl)$/.test(keyName)) {
          context.report({node: key, messageId: 'forbidden'});
        }
      },
    };
  },
});

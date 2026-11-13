import {defineRule, type ESTree} from '@oxlint/plugins';

const RELATIVE_API_URL = /^\/api\/0(?:[/?]|$)/;

function isApiClient(node: ESTree.Node): boolean {
  if (node.type === 'Identifier') {
    return node.name === 'api';
  }
  return (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier' &&
    node.property.name === 'api'
  );
}

/**
 * Whether the node starts the URL it builds. `host + '/api/0/'` and
 * `${host}${api.baseUrl}` put a host in front, so they are not relative.
 */
function startsUrl(node: ESTree.Node): boolean {
  const parent = node.parent;
  if (parent?.type === 'BinaryExpression' && parent.operator === '+') {
    return parent.left === node;
  }
  if (parent?.type === 'TemplateLiteral') {
    return parent.expressions[0] === node && parent.quasis[0]?.value.cooked === '';
  }
  return true;
}

/**
 * Whether the URL that the node starts is passed straight to
 * `resolveHostname()`, which adds the host. Walks up through the `+` and
 * template literals that the node starts.
 */
function isResolved(node: ESTree.Node): boolean {
  let url: ESTree.Node = node;
  while (
    url.parent &&
    ((url.parent.type === 'BinaryExpression' &&
      url.parent.operator === '+' &&
      url.parent.left === url) ||
      (url.parent.type === 'TemplateLiteral' &&
        url.parent.expressions[0] === url &&
        url.parent.quasis[0]?.value.cooked === ''))
  ) {
    url = url.parent;
  }
  const call = url.parent;
  return (
    call?.type === 'CallExpression' &&
    call.arguments[0] === url &&
    call.callee.type === 'Identifier' &&
    call.callee.name === 'resolveHostname'
  );
}

function isRelative(node: ESTree.Node): boolean {
  return startsUrl(node) && !isResolved(node);
}

export const noRelativeApiUrl = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow relative /api/0 URLs, which send requests through the control silo API gateway.',
    },
    schema: [],
    messages: {
      relativeApiUrl:
        'Relative /api/0 URLs resolve against the organization subdomain and go through the control silo API gateway. Pass the path without /api/0 to the API client, or pass the URL straight to resolveHostname() from sentry/utils/api/resolveHostname.',
      apiBaseUrl:
        'api.baseUrl is a relative /api/0 prefix, so URLs built from it go through the control silo API gateway. Pass the URL straight to resolveHostname() from sentry/utils/api/resolveHostname.',
    },
  },
  create(context) {
    return {
      Literal(node) {
        if (
          typeof node.value === 'string' &&
          RELATIVE_API_URL.test(node.value) &&
          isRelative(node)
        ) {
          context.report({node, messageId: 'relativeApiUrl'});
        }
      },
      TemplateLiteral(node) {
        const first = node.quasis[0]?.value.cooked;
        if (first && RELATIVE_API_URL.test(first) && isRelative(node)) {
          context.report({node, messageId: 'relativeApiUrl'});
        }
      },
      MemberExpression(node) {
        if (
          !node.computed &&
          node.property.type === 'Identifier' &&
          node.property.name === 'baseUrl' &&
          isApiClient(node.object) &&
          isRelative(node)
        ) {
          context.report({node, messageId: 'apiBaseUrl'});
        }
      },
    };
  },
});

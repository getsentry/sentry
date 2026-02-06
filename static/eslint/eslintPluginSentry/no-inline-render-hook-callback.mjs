const HOOK_RENDERERS = new Set(['renderHook', 'renderHookWithProviders']);

/**
 * @param {import('estree').Expression | import('estree').Super | null | undefined} callee
 * @returns {callee is import('estree').Identifier}
 */
function isHookRenderer(callee) {
  return Boolean(
    callee && callee.type === 'Identifier' && HOOK_RENDERERS.has(callee.name)
  );
}

/**
 * @param {import('estree').CallExpression['arguments'][number] | undefined} node
 * @returns {node is import('estree').ArrowFunctionExpression | import('estree').FunctionExpression}
 */
function isInlineFunction(node) {
  return Boolean(
    node &&
    (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression')
  );
}

/**
 * @type {import('eslint').Rule.RuleModule}
 */
const noInlineRenderHookCallback = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow inline callbacks for renderHook and renderHookWithProviders. Pass the hook directly and use initialProps.',
      recommended: true,
    },
    schema: [],
    messages: {
      forbidden:
        'Do not pass an inline function to {{renderer}}. Pass the hook directly and provide values via `initialProps`.',
    },
  },

  create(context) {
    return {
      CallExpression(node) {
        if (!isHookRenderer(node.callee)) {
          return;
        }

        const callbackArg = node.arguments[0];
        if (!isInlineFunction(callbackArg)) {
          return;
        }

        context.report({
          node: callbackArg,
          messageId: 'forbidden',
          data: {renderer: node.callee.name},
        });
      },
    };
  },
};

export default noInlineRenderHookCallback;

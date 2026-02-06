const HOOK_RENDERERS = new Set(['renderHook', 'renderHookWithProviders']);

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
        const callee = node.callee;
        if (callee.type !== 'Identifier' || !HOOK_RENDERERS.has(callee.name)) {
          return;
        }

        const callbackArg = node.arguments[0];
        if (!callbackArg || callbackArg.type === 'SpreadElement') {
          return;
        }

        if (
          callbackArg.type !== 'ArrowFunctionExpression' &&
          callbackArg.type !== 'FunctionExpression'
        ) {
          return;
        }

        context.report({
          node: callbackArg,
          messageId: 'forbidden',
          data: {renderer: callee.name},
        });
      },
    };
  },
};

export default noInlineRenderHookCallback;

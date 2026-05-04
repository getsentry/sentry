import {AST_NODE_TYPES, ESLintUtils, type TSESTree} from '@typescript-eslint/utils';

const SETUP_HOOKS = new Set(['beforeEach', 'beforeAll']);
const CLEANUP_HOOKS = new Set(['afterEach', 'afterAll']);
const TEST_FUNCTIONS = new Set(['it', 'test']);

function isJestMethod(node: TSESTree.CallExpression, method: string): boolean {
  return (
    node.callee.type === AST_NODE_TYPES.MemberExpression &&
    node.callee.object.type === AST_NODE_TYPES.Identifier &&
    node.callee.object.name === 'jest' &&
    node.callee.property.type === AST_NODE_TYPES.Identifier &&
    node.callee.property.name === method
  );
}

function getEnclosingHookOrTestName(node: TSESTree.Node): string | null {
  let current = node.parent;
  while (current) {
    if (current.type === AST_NODE_TYPES.CallExpression) {
      const {callee} = current;
      let name: string | null = null;
      if (callee.type === AST_NODE_TYPES.Identifier) {
        name = callee.name;
      } else if (
        callee.type === AST_NODE_TYPES.MemberExpression &&
        callee.object.type === AST_NODE_TYPES.Identifier
      ) {
        name = callee.object.name;
      }
      if (
        name &&
        (SETUP_HOOKS.has(name) ||
          CLEANUP_HOOKS.has(name) ||
          TEST_FUNCTIONS.has(name) ||
          name === 'describe')
      ) {
        return name;
      }
    }
    current = current.parent;
  }
  return null;
}

export const requireFakeTimerCleanup = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require jest.useFakeTimers() to be in beforeEach/beforeAll with proper cleanup in afterEach/afterAll.',
    },
    schema: [],
    messages: {
      useFakeTimersNotInHook:
        'jest.useFakeTimers() should be called inside beforeEach() or beforeAll(), not at module level or inside test blocks.',
      missingCleanup:
        'Files using jest.useFakeTimers() must have an afterEach (or afterAll) that calls jest.useRealTimers().',
      missingRunOnlyPendingTimers:
        'afterEach/afterAll calls jest.useRealTimers() but is missing jest.runOnlyPendingTimers(). Call it before jest.useRealTimers() to flush pending timers.',
    },
  },
  create(context) {
    const useFakeTimersCalls: TSESTree.CallExpression[] = [];
    let hasUseRealTimersInCleanup = false;
    let hasRunOnlyPendingTimersInCleanup = false;

    return {
      CallExpression(node) {
        if (isJestMethod(node, 'useFakeTimers')) {
          useFakeTimersCalls.push(node);
        }
        if (isJestMethod(node, 'useRealTimers')) {
          const enclosing = getEnclosingHookOrTestName(node);
          if (enclosing && CLEANUP_HOOKS.has(enclosing)) {
            hasUseRealTimersInCleanup = true;
          }
        }
        if (isJestMethod(node, 'runOnlyPendingTimers')) {
          const enclosing = getEnclosingHookOrTestName(node);
          if (enclosing && CLEANUP_HOOKS.has(enclosing)) {
            hasRunOnlyPendingTimersInCleanup = true;
          }
        }
      },

      'Program:exit'() {
        if (useFakeTimersCalls.length === 0) {
          return;
        }

        for (const call of useFakeTimersCalls) {
          const enclosing = getEnclosingHookOrTestName(call);
          if (!enclosing || !SETUP_HOOKS.has(enclosing)) {
            context.report({
              node: call,
              messageId: 'useFakeTimersNotInHook',
            });
          }
        }

        if (!hasUseRealTimersInCleanup) {
          context.report({
            node: useFakeTimersCalls[0]!,
            messageId: 'missingCleanup',
          });
        } else if (!hasRunOnlyPendingTimersInCleanup) {
          context.report({
            node: useFakeTimersCalls[0]!,
            messageId: 'missingRunOnlyPendingTimers',
          });
        }
      },
    };
  },
});

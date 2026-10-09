import {defineRule, type ESTree} from '@oxlint/plugins';

const SETUP_HOOKS = new Set(['beforeEach', 'beforeAll']);
const CLEANUP_HOOKS = new Set(['afterEach', 'afterAll']);
const TEST_FUNCTIONS = new Set(['it', 'test']);
type Callback = ESTree.ArrowFunctionExpression | ESTree.Function;

function isJestMethod(node: ESTree.CallExpression, method: string): boolean {
  return (
    node.callee.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === 'jest' &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === method
  );
}

function callName(node: ESTree.CallExpression): string | null {
  let callee = node.callee;
  while (callee.type === 'MemberExpression' || callee.type === 'CallExpression') {
    callee = callee.type === 'CallExpression' ? callee.callee : callee.object;
  }
  return callee.type === 'Identifier' ? callee.name : null;
}

function callbackName(node: ESTree.Node): string | null {
  return (node.type === 'ArrowFunctionExpression' ||
    node.type === 'FunctionExpression') &&
    node.parent.type === 'CallExpression' &&
    node.parent.arguments.includes(node)
    ? callName(node.parent)
    : null;
}

function enclosingCallback(node: ESTree.Node): ESTree.Node | null {
  let current = node.parent;
  while (current) {
    if (
      current.type === 'ArrowFunctionExpression' ||
      current.type === 'FunctionExpression' ||
      current.type === 'FunctionDeclaration'
    ) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

function suite(node: ESTree.Node): ESTree.Node {
  let current = node;
  while (current.parent && callbackName(current) !== 'describe') {
    current = current.parent;
  }
  return current;
}

function contains(ancestor: ESTree.Node, node: ESTree.Node): boolean {
  let current: ESTree.Node | null = node;
  while (current) {
    if (current === ancestor) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

// shortcut: only straight-line cleanup and act callbacks are proven, extend when other cleanup idioms need support.
function cleanupCalls(
  node: ESTree.Node | null,
  awaited = false
): ESTree.CallExpression[] {
  if (!node) {
    return [];
  }
  if (node.type === 'BlockStatement') {
    const calls: ESTree.CallExpression[] = [];
    for (const statement of node.body) {
      if (
        statement.type === 'VariableDeclaration' ||
        statement.type === 'FunctionDeclaration' ||
        statement.type === 'EmptyStatement'
      ) {
        continue;
      }
      if (statement.type === 'ReturnStatement') {
        if (statement.argument) {
          calls.push(...cleanupCalls(statement.argument, awaited));
        }
        break;
      }
      if (statement.type !== 'ExpressionStatement') {
        break;
      }
      calls.push(...cleanupCalls(statement.expression));
    }
    return calls;
  }
  if (node.type === 'AwaitExpression') {
    return cleanupCalls(node.argument, true);
  }
  if (node.type !== 'CallExpression') {
    return [];
  }
  if (
    isJestMethod(node, 'useRealTimers') ||
    isJestMethod(node, 'runOnlyPendingTimers') ||
    (awaited && isJestMethod(node, 'runOnlyPendingTimersAsync'))
  ) {
    return [node];
  }
  if (node.callee.type === 'Identifier' && node.callee.name === 'act') {
    const callback = node.arguments[0];
    if (
      callback &&
      (callback.type === 'ArrowFunctionExpression' ||
        callback.type === 'FunctionExpression') &&
      (!callback.async || awaited)
    ) {
      return cleanupCalls(callback.body, awaited);
    }
  }
  return [];
}

export const requireFakeTimerCleanup = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require fake timers in setup hooks or tests to have matching teardown that flushes pending timers before restoring real timers.',
    },
    schema: [],
    messages: {
      useFakeTimersNotInHook:
        'Call jest.useFakeTimers() directly inside beforeEach(), beforeAll(), it(), or test().',
      missingCleanup:
        'Fake timers require a matching teardown in this suite or an ancestor: afterEach for tests/beforeEach, afterAll for beforeAll, calling jest.useRealTimers().',
      missingRunOnlyPendingTimers:
        'Flush pending timers with jest.runOnlyPendingTimers() or await jest.runOnlyPendingTimersAsync() before jest.useRealTimers() in the matching teardown.',
    },
  },
  create(context) {
    const fakeCalls: ESTree.CallExpression[] = [];
    const hooks: Array<{callback: Callback; name: string; scope: ESTree.Node}> = [];
    return {
      CallExpression(node) {
        if (isJestMethod(node, 'useFakeTimers')) {
          fakeCalls.push(node);
        }
        const name = callName(node);
        const callback = node.arguments[0];
        if (
          name &&
          CLEANUP_HOOKS.has(name) &&
          callback &&
          (callback.type === 'ArrowFunctionExpression' ||
            callback.type === 'FunctionExpression')
        ) {
          const owner = enclosingCallback(node);
          if (!owner || callbackName(owner) === 'describe') {
            hooks.push({callback, name, scope: suite(node)});
          }
        }
      },
      'Program:exit'() {
        for (const call of fakeCalls) {
          const owner = enclosingCallback(call);
          const name = owner ? callbackName(owner) : null;
          if (!name || (!SETUP_HOOKS.has(name) && !TEST_FUNCTIONS.has(name))) {
            context.report({node: call, messageId: 'useFakeTimersNotInHook'});
          }
          const applicable = hooks.filter(
            hook =>
              hook.name === (name === 'beforeAll' ? 'afterAll' : 'afterEach') &&
              contains(hook.scope, suite(call))
          );
          const restores = applicable.flatMap(hook => {
            let flushed = false;
            return cleanupCalls(hook.callback.body).flatMap(cleanup => {
              if (isJestMethod(cleanup, 'useRealTimers')) {
                const result = flushed;
                flushed = false;
                return [result];
              }
              flushed = true;
              return [];
            });
          });
          if (restores.length === 0) {
            context.report({node: call, messageId: 'missingCleanup'});
          } else if (restores.some(flushed => !flushed)) {
            context.report({node: call, messageId: 'missingRunOnlyPendingTimers'});
          }
        }
      },
    };
  },
});

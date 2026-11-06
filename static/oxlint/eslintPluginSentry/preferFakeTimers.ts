import {defineRule, type ESTree} from '@oxlint/plugins';

type FunctionNode = ESTree.ArrowFunctionExpression | ESTree.Function;
type Frame = {
  kind: 'suite' | 'test' | 'beforeAll' | 'beforeEach' | 'other';
  node: FunctionNode | ESTree.Program;
  parent: Frame | undefined;
  timers: Array<{fake: boolean; node: ESTree.CallExpression}>;
};

const testingLibraries = new Set([
  'sentry-test/reactTestingLibrary',
  '@testing-library/react',
  '@testing-library/dom',
]);

function propertyName(
  node: ESTree.MemberExpression | ESTree.ObjectProperty | ESTree.BindingProperty
) {
  const key = node.type === 'MemberExpression' ? node.property : node.key;
  return !node.computed && key.type === 'Identifier'
    ? key.name
    : key.type === 'Literal' && typeof key.value === 'string'
      ? key.value
      : undefined;
}

export const preferFakeTimers = defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer fake timers when tests explicitly wait for time to pass.',
    },
    schema: [],
    messages: {
      preferFakeTimers:
        'This test waits with an explicit timeout. If it waits for a countdown, debounce, polling, or retry delay, use jest.useFakeTimers() and advance the clock instead of waiting in real time.',
      sleep:
        'This test sleeps in real time. Use jest.useFakeTimers() and advance the clock instead.',
    },
  },
  create(context) {
    const frames: Frame[] = [];
    const candidates: Array<{
      frame: Frame;
      messageId: 'preferFakeTimers' | 'sleep';
      node: ESTree.CallExpression | ESTree.NewExpression;
    }> = [];
    let current: Frame | undefined;

    function binding(node: ESTree.IdentifierReference | ESTree.BindingIdentifier) {
      let scope = context.sourceCode.getScope(node);
      while (scope) {
        const variable = scope.variables.find(value => value.name === node.name);
        if (variable) {
          return variable;
        }
        scope = scope.upper!;
      }
      return;
    }

    function origin(
      node: ESTree.Node,
      seen = new Set<ESTree.Node>()
    ): string | undefined {
      if (seen.has(node)) {
        return undefined;
      }
      seen.add(node);
      if (node.type === 'Identifier') {
        const definition = binding(node)?.defs[0];
        if (!definition) {
          return ['jest', 'describe', 'it', 'test', 'beforeAll', 'beforeEach'].includes(
            node.name
          )
            ? node.name
            : undefined;
        }
        if (
          definition.type === 'ImportBinding' &&
          definition.parent?.type === 'ImportDeclaration'
        ) {
          const source = definition.parent.source.value;
          const specifier = definition.node;
          if (!testingLibraries.has(source) && source !== '@jest/globals') {
            return undefined;
          }
          if (specifier.type === 'ImportNamespaceSpecifier') {
            return source === '@jest/globals' ? 'jestGlobals' : 'rtl';
          }
          if (specifier.type === 'ImportSpecifier') {
            const imported = specifier.imported;
            const name = imported.type === 'Identifier' ? imported.name : imported.value;
            return source === '@jest/globals' ? name : `rtl.${name}`;
          }
        }
        if (
          definition.type === 'Variable' &&
          definition.node.type === 'VariableDeclarator'
        ) {
          const declaration = definition.node;
          if (
            !declaration.init ||
            binding(node)?.references.some(ref => ref.isWrite() && !ref.init)
          ) {
            return undefined;
          }
          if (declaration.id.type === 'Identifier') {
            return origin(declaration.init, seen);
          }
          if (declaration.id.type === 'ObjectPattern') {
            const property = declaration.id.properties.find(
              item =>
                item.type === 'Property' &&
                item.value.type === 'Identifier' &&
                item.value.name === node.name
            );
            const base = origin(declaration.init, seen);
            if (property?.type === 'Property' && base) {
              return `${base}.${propertyName(property)}`;
            }
          }
        }
        return undefined;
      }
      if (node.type === 'MemberExpression') {
        const base = origin(node.object, seen);
        const property = propertyName(node);
        return base && property
          ? base === 'jestGlobals'
            ? property
            : `${base}.${property}`
          : undefined;
      }
      if (node.type === 'CallExpression') {
        const callee = origin(node.callee, seen);
        if (callee === 'rtl.within' || callee === 'rtl.render') {
          return 'rtl.queries';
        }
        if (callee?.endsWith('.each')) {
          return callee;
        }
      }
      if (node.type === 'TaggedTemplateExpression') {
        const tag = origin(node.tag, seen);
        return tag?.endsWith('.each') ? tag : undefined;
      }
      return undefined;
    }

    // shortcut: resolve literal/const values only; extend when historical cases need computed waits.
    function resolved(
      node: ESTree.Node | undefined,
      seen = new Set<ESTree.Node>()
    ): ESTree.Node | undefined {
      if (!node || seen.has(node)) {
        return undefined;
      }
      seen.add(node);
      if (node.type !== 'Identifier') {
        return node;
      }
      const variable = binding(node);
      const definition = variable?.defs[0];
      return definition?.type === 'Variable' &&
        definition.node.type === 'VariableDeclarator' &&
        definition.parent?.type === 'VariableDeclaration' &&
        definition.parent.kind === 'const' &&
        !variable?.references.some(ref => ref.isWrite() && !ref.init)
        ? resolved(definition.node.init ?? undefined, seen)
        : undefined;
    }

    function isUnconditional(node: ESTree.Node, frame: Frame) {
      let parent = node.parent;
      while (parent && parent !== frame.node) {
        if (
          parent.type !== 'ExpressionStatement' &&
          parent.type !== 'BlockStatement' &&
          parent.type !== 'AwaitExpression'
        ) {
          return false;
        }
        parent = parent.parent;
      }
      return parent === frame.node;
    }

    function enter(node: FunctionNode) {
      const call = node.parent;
      const name =
        call?.type === 'CallExpression' && call.arguments.includes(node)
          ? origin(call.callee)?.split('.')[0]
          : undefined;
      const kind =
        name === 'describe'
          ? 'suite'
          : name === 'it' || name === 'test'
            ? 'test'
            : name === 'beforeEach' || name === 'beforeAll'
              ? name
              : 'other';
      current = {node, kind, parent: current, timers: []};
      frames.push(current);
    }

    function fakeAt(candidate: (typeof candidates)[number]) {
      const ancestors: Frame[] = [];
      for (let frame: Frame | undefined = candidate.frame; frame; frame = frame.parent) {
        ancestors.unshift(frame);
      }
      let fake = false;
      const apply = (frame: Frame, before = Infinity) => {
        for (const timer of frame.timers) {
          if (timer.node.start < before) {
            fake = timer.fake;
          }
        }
      };
      for (const ancestor of ancestors) {
        if (ancestor.kind === 'suite') {
          apply(ancestor);
          for (const hook of frames.filter(
            frame => frame.parent === ancestor && frame.kind === 'beforeAll'
          )) {
            apply(hook);
          }
        }
      }
      for (const ancestor of ancestors) {
        if (ancestor.kind === 'suite') {
          for (const hook of frames.filter(
            frame => frame.parent === ancestor && frame.kind === 'beforeEach'
          )) {
            apply(hook);
          }
        }
      }
      apply(candidate.frame, candidate.node.start);
      return fake;
    }

    return {
      Program(node) {
        current = {node, kind: 'suite', parent: undefined, timers: []};
        frames.push(current);
      },
      ArrowFunctionExpression: enter,
      FunctionExpression: enter,
      FunctionDeclaration: enter,
      'ArrowFunctionExpression:exit'() {
        current = current?.parent;
      },
      'FunctionExpression:exit'() {
        current = current?.parent;
      },
      'FunctionDeclaration:exit'() {
        current = current?.parent;
      },
      NewExpression(node) {
        if (
          current?.kind !== 'test' ||
          node.parent.type !== 'AwaitExpression' ||
          node.callee.type !== 'Identifier' ||
          node.callee.name !== 'Promise' ||
          binding(node.callee)?.defs.length
        ) {
          return;
        }
        const executor = node.arguments[0];
        if (
          executor?.type !== 'ArrowFunctionExpression' &&
          executor?.type !== 'FunctionExpression'
        ) {
          return;
        }
        const resolve = executor.params[0];
        const body = executor.body;
        if (!body) {
          return;
        }
        const expression =
          body.type === 'BlockStatement' &&
          body.body.length === 1 &&
          body.body[0]?.type === 'ExpressionStatement'
            ? body.body[0].expression
            : body;
        if (
          resolve?.type !== 'Identifier' ||
          expression.type !== 'CallExpression' ||
          expression.callee.type !== 'Identifier' ||
          expression.callee.name !== 'setTimeout' ||
          binding(expression.callee)?.defs.length
        ) {
          return;
        }
        const callback = expression.arguments[0];
        const delay = resolved(expression.arguments[1]);
        if (
          callback?.type === 'Identifier' &&
          binding(callback) === binding(resolve) &&
          delay?.type === 'Literal' &&
          typeof delay.value === 'number' &&
          Number.isFinite(delay.value) &&
          delay.value > 0
        ) {
          candidates.push({node, frame: current, messageId: 'sleep'});
        }
      },
      CallExpression(node) {
        if (!current) {
          return;
        }
        const name = origin(node.callee);
        if (
          name === 'jest.useRealTimers' ||
          (name === 'jest.useFakeTimers' && isUnconditional(node, current))
        ) {
          current.timers.push({node, fake: name === 'jest.useFakeTimers'});
        }
        if (current.kind !== 'test' || !name?.startsWith('rtl.')) {
          return;
        }
        const options = resolved(
          name === 'rtl.waitFor'
            ? node.arguments[1]
            : /^rtl\.(?:(screen|queries)\.)?find(All)?By[A-Z]/.test(name)
              ? node.arguments[name.split('.').length === 2 ? 3 : 2]
              : undefined
        );
        if (
          options?.type !== 'ObjectExpression' ||
          options.properties.some(
            property =>
              property.type === 'SpreadElement' ||
              (property.computed && propertyName(property) === undefined)
          )
        ) {
          return;
        }
        const timeout = options.properties.findLast(
          property => property.type === 'Property' && propertyName(property) === 'timeout'
        );
        const value = timeout?.type === 'Property' ? resolved(timeout.value) : undefined;
        if (
          value?.type === 'Literal' &&
          typeof value.value === 'number' &&
          Number.isFinite(value.value) &&
          value.value > 0
        ) {
          candidates.push({node, frame: current, messageId: 'preferFakeTimers'});
        }
      },
      'Program:exit'() {
        for (const candidate of candidates) {
          if (!fakeAt(candidate)) {
            context.report({node: candidate.node, messageId: candidate.messageId});
          }
        }
      },
    };
  },
});

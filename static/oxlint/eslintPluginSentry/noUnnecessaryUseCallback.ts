import {defineRule, type ESTree, type Variable} from '@oxlint/plugins';

interface UsageInfo {
  line: number;
  reason: 'directlyInvoked' | 'intrinsicElement' | 'unmemoizedComponent';
  element?: string;
}

function isStableCallbackArgument(node: ESTree.Node | undefined): boolean {
  if (!node) {
    return false;
  }
  if (
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'TSInstantiationExpression' ||
    node.type === 'ChainExpression'
  ) {
    return isStableCallbackArgument(node.expression);
  }
  if (node.type === 'ConditionalExpression') {
    return (
      isStableCallbackArgument(node.consequent) &&
      isStableCallbackArgument(node.alternate)
    );
  }
  if (node.type === 'LogicalExpression') {
    return isStableCallbackArgument(node.left) && isStableCallbackArgument(node.right);
  }
  return (
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'FunctionExpression' ||
    node.type === 'Identifier' ||
    node.type === 'MemberExpression'
  );
}

function formatUsages(usages: UsageInfo[]): string {
  return usages
    .map(u => {
      if (u.reason === 'directlyInvoked') {
        return `directly invoked in line ${u.line}`;
      }
      if (u.reason === 'unmemoizedComponent') {
        return `passed to unmemoized component <${u.element}> in line ${u.line}`;
      }
      return `passed to intrinsic element <${u.element}> in line ${u.line}`;
    })
    .join(' and ');
}

export const noUnnecessaryUseCallback = defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow useCallback where it provides no benefit: when the result is directly invoked (defeating memoization) or passed to intrinsic elements (which are not memoized).',
    },
    hasSuggestions: true,
    schema: [],
    messages: {
      unnecessaryUseCallback:
        'Unnecessary useCallback. `{{name}}` is only used in contexts where memoization provides no benefit. It is {{usages}}.',
      removeUseCallback: 'Remove useCallback wrapper.',
    },
  },
  create(context) {
    const useCallbackBindings = new Map<Variable, ESTree.CallExpression>();
    // Collected flagged usages per Variable
    const flaggedUsages = new Map<Variable, UsageInfo[]>();
    const flaggedReferences = new Map<Variable, Set<ESTree.Node>>();
    // Local names imported from @sentry/scraps (these components are never memoized)
    const scrapsImports = new Set<string>();
    // Names that are aliased imports of useCallback (e.g. `import {useCallback as uc}`)
    const useCallbackNames = new Set(['useCallback']);

    /**
     * Resolve an Identifier node to its scope Variable, returning undefined
     * if the variable cannot be found.
     */
    function resolveVariable(
      node: ESTree.IdentifierReference | ESTree.BindingIdentifier
    ): Variable | undefined {
      let scope = context.sourceCode.getScope(node);
      while (scope) {
        const variable = scope.variables.find(v => v.name === node.name);
        if (variable) {
          return variable;
        }
        scope = scope.upper!;
      }
      return undefined;
    }

    function addFlaggedUsage(
      variable: Variable,
      usage: UsageInfo,
      references: ESTree.Node[]
    ) {
      let flagged = flaggedReferences.get(variable);
      if (!flagged) {
        flagged = new Set();
        flaggedReferences.set(variable, flagged);
      }
      const added = references.filter(reference => !flagged.has(reference));
      if (added.length === 0) {
        return;
      }
      for (const reference of added) {
        flagged.add(reference);
      }
      let usages = flaggedUsages.get(variable);
      if (!usages) {
        usages = [];
        flaggedUsages.set(variable, usages);
      }
      usages.push(usage);
    }

    // Uses visitorKeys to avoid circular parent references.
    function findCallsToBindings(
      node: ESTree.Node,
      calls: Array<{callee: ESTree.Node; variable: Variable}> = []
    ): Array<{callee: ESTree.Node; variable: Variable}> {
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
        const variable = resolveVariable(node.callee);
        if (variable && useCallbackBindings.has(variable)) {
          calls.push({callee: node.callee, variable});
        }
      }
      const keys = context.sourceCode.visitorKeys[node.type] ?? [];
      for (const key of keys) {
        const child = node[key as keyof typeof node] as
          | ESTree.Node
          | Array<ESTree.Node | null>
          | null
          | undefined;
        for (const item of Array.isArray(child) ? child : [child]) {
          if (item) {
            findCallsToBindings(item, calls);
          }
        }
      }
      return calls;
    }

    // Scraps components that use memoized callbacks internally
    const scrapsExclusions = new Set(['CompactSelect', 'CodeBlock']);

    return {
      ImportDeclaration(node) {
        const source = node.source.value;

        // Track aliased useCallback imports
        if (source === 'react') {
          for (const spec of node.specifiers) {
            if (
              spec.type === 'ImportSpecifier' &&
              spec.imported.type === 'Identifier' &&
              spec.imported.name === 'useCallback'
            ) {
              useCallbackNames.add(spec.local.name);
            }
          }
        }

        if (source.startsWith('@sentry/scraps')) {
          for (const spec of node.specifiers) {
            if (!scrapsExclusions.has(spec.local.name)) {
              scrapsImports.add(spec.local.name);
            }
          }
        }
      },

      VariableDeclarator(node) {
        if (
          node.id.type === 'Identifier' &&
          node.init?.type === 'CallExpression' &&
          node.init.callee.type === 'Identifier' &&
          useCallbackNames.has(node.init.callee.name) &&
          isStableCallbackArgument(node.init.arguments[0])
        ) {
          const variable = resolveVariable(node.id);
          if (variable) {
            useCallbackBindings.set(variable, node.init);
          }
        }
      },

      JSXAttribute(node) {
        if (node.value?.type !== 'JSXExpressionContainer') {
          return;
        }

        const expr = node.value.expression;

        // Case 1: Arrow function that calls a useCallback binding in its body
        // e.g. onClick={() => fn()}, onClick={(e) => fn(e)},
        //      onClick={() => { fn(); doSomethingElse(); }}
        // The arrow wrapper creates a new ref each render, defeating memoization.
        if (expr.type === 'ArrowFunctionExpression') {
          const calls = findCallsToBindings(expr.body);
          for (const variable of new Set(calls.map(call => call.variable))) {
            addFlaggedUsage(
              variable,
              {reason: 'directlyInvoked', line: node.value.loc.start.line},
              calls.filter(call => call.variable === variable).map(call => call.callee)
            );
          }
          return;
        }

        // Exception: ref props are callback refs that benefit from memoization
        const propName = node.name.type === 'JSXIdentifier' ? node.name.name : null;
        if (propName === 'ref') {
          return;
        }

        // Case 2: Direct reference on an unmemoized element — counts as 1 reference.
        // This includes intrinsic elements and components from @sentry/scraps.
        if (expr.type === 'Identifier') {
          const variable = resolveVariable(expr);
          if (!variable || !useCallbackBindings.has(variable)) {
            return;
          }

          const openingElement = node.parent;
          if (openingElement.type !== 'JSXOpeningElement') {
            return;
          }
          const tagName = openingElement.name;
          if (tagName.type !== 'JSXIdentifier') {
            return;
          }

          if (/^[a-z]/.test(tagName.name)) {
            addFlaggedUsage(
              variable,
              {
                reason: 'intrinsicElement',
                element: tagName.name,
                line: node.value.loc.start.line,
              },
              [expr]
            );
          } else if (scrapsImports.has(tagName.name)) {
            addFlaggedUsage(
              variable,
              {
                reason: 'unmemoizedComponent',
                element: tagName.name,
                line: node.value.loc.start.line,
              },
              [expr]
            );
          }
        }
      },

      'Program:exit'() {
        for (const [variable, usages] of flaggedUsages) {
          // Count total references to this binding via scope analysis.
          // If there are references beyond the ones we flagged, the
          // useCallback may be justified (dep arrays, other hooks, etc.)
          const totalRefs = variable.references.filter(r => r.isRead()).length;
          const flagged = flaggedReferences.get(variable)?.size ?? 0;

          if (totalRefs > flagged) {
            continue;
          }

          const name = variable.name;
          const callNode = useCallbackBindings.get(variable)!;
          const firstArg = callNode.arguments[0];
          const callbackText = context.sourceCode.getText(firstArg);
          context.report({
            node: callNode,
            messageId: 'unnecessaryUseCallback',
            data: {name, usages: formatUsages(usages)},
            suggest: [
              {
                messageId: 'removeUseCallback',
                fix(fixer) {
                  return fixer.replaceText(callNode, callbackText);
                },
              },
            ],
          });
        }
      },
    };
  },
});

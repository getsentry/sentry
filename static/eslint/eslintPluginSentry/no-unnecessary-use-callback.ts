import {AST_NODE_TYPES, ESLintUtils, type TSESTree} from '@typescript-eslint/utils';

interface UsageInfo {
  line: number;
  reason: 'directlyInvoked' | 'intrinsicElement' | 'unmemoizedComponent';
  element?: string;
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

export const noUnnecessaryUseCallback = ESLintUtils.RuleCreator.withoutDocs({
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
    // Maps binding name to the useCallback() CallExpression node and its declaring scope
    const useCallbackBindings = new Map<
      string,
      {declarator: TSESTree.VariableDeclarator; node: TSESTree.CallExpression}
    >();
    // Collected flagged usages per binding
    const flaggedUsages = new Map<string, UsageInfo[]>();
    // Number of references we've accounted for (flagged) per binding
    const flaggedRefCount = new Map<string, number>();
    // Local names imported from @sentry/scraps (these components are never memoized)
    const scrapsImports = new Set<string>();

    function addFlaggedUsage(name: string, usage: UsageInfo) {
      let usages = flaggedUsages.get(name);
      if (!usages) {
        usages = [];
        flaggedUsages.set(name, usages);
      }
      usages.push(usage);
      flaggedRefCount.set(name, (flaggedRefCount.get(name) ?? 0) + refCount);
    }

    /**
     * Walks an AST node looking for a CallExpression whose callee is a
     * tracked useCallback binding. Returns the binding name if found.
     * Uses visitorKeys to avoid circular parent references.
     */
    function findCallToBinding(node: TSESTree.Node): string | null {
      if (
        node.type === AST_NODE_TYPES.CallExpression &&
        node.callee.type === AST_NODE_TYPES.Identifier &&
        useCallbackBindings.has(node.callee.name)
      ) {
        return node.callee.name;
      }
      const keys = context.sourceCode.visitorKeys[node.type] ?? [];
      for (const key of keys) {
        const child = node[key as keyof typeof node] as
          | TSESTree.Node
          | TSESTree.Node[]
          | null
          | undefined;
        if (Array.isArray(child)) {
          for (const item of child) {
            if (item) {
              const result = findCallToBinding(item);
              if (result) {
                return result;
              }
            }
          }
        } else if (child) {
          const result = findCallToBinding(child);
          if (result) {
            return result;
          }
        }
      }
      return null;
    }

    function getJSXElementName(nameNode: TSESTree.JSXTagNameExpression) {
      return nameNode.type === AST_NODE_TYPES.JSXIdentifier
        ? nameNode.name
        : getStaticValue(nameNode)?.value?.toString();
    }

    // Scraps components that use memoized callbacks internally
    const scrapsExclusions = new Set(['CompactSelect', 'CodeBlock']);

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source === 'string' && source.startsWith('@sentry/scraps')) {
          for (const spec of node.specifiers) {
            if (!scrapsExclusions.has(spec.local.name)) {
              scrapsImports.add(spec.local.name);
            }
          }
        }
      },

      VariableDeclarator(node) {
        if (node.id.type !== AST_NODE_TYPES.Identifier) {
          return;
        }
        if (
          node.init?.type === AST_NODE_TYPES.CallExpression &&
          node.init.callee.type === AST_NODE_TYPES.Identifier &&
          node.init.callee.name === 'useCallback'
        ) {
          useCallbackBindings.set(node.id.name, {node: node.init, declarator: node});
        }
      },

      JSXAttribute(node) {
        if (node.value?.type !== AST_NODE_TYPES.JSXExpressionContainer) {
          return;
        }

        const expr = node.value.expression;

        // Case 1: Arrow function that calls a useCallback binding in its body
        // e.g. onClick={() => fn()}, onClick={(e) => fn(e)},
        //      onClick={() => { fn(); doSomethingElse(); }}
        // Case 1: Arrow function that calls a useCallback binding in its body
        // The arrow wrapper creates a new ref each render, defeating memoization.
        // The binding is referenced inside the arrow body — count as 1 reference.
        if (expr.type === AST_NODE_TYPES.ArrowFunctionExpression) {
          const calledBinding = findCallToBinding(expr.body);
          if (calledBinding) {
            addFlaggedUsage(
              calledBinding,
              {reason: 'directlyInvoked', line: node.value.loc.start.line},
              1
            );
            return;
          }
        }

        // Exception: ref props are callback refs that benefit from memoization
        const propName =
          node.name.type === AST_NODE_TYPES.JSXIdentifier ? node.name.name : null;
        if (propName === 'ref') {
          return;
        }

        // Case 2: Direct reference on an unmemoized element — counts as 1 reference.
        // This includes intrinsic elements and components from @sentry/scraps.
        if (
          expr.type === AST_NODE_TYPES.Identifier &&
          useCallbackBindings.has(expr.name)
        ) {
          const openingElement = node.parent;
          if (openingElement.type !== AST_NODE_TYPES.JSXOpeningElement) {
            return;
          }
          const tagName = openingElement.name;
          const elementName = getJSXElementName(tagName);

          if (
            tagName.type === AST_NODE_TYPES.JSXIdentifier &&
            tagName.name[0] === tagName.name[0]?.toLowerCase()
          ) {
            addFlaggedUsage(
              expr.name,
              {
                reason: 'intrinsicElement',
                element: tagName.name,
                line: node.value.loc.start.line,
              },
              1
            );
          } else if (elementName && scrapsImports.has(elementName)) {
            addFlaggedUsage(
              expr.name,
              {
                reason: 'unmemoizedComponent',
                element: elementName,
                line: node.value.loc.start.line,
              },
              1
            );
          }
        }
      },

      'Program:exit'() {
        for (const [name, usages] of flaggedUsages) {
          const binding = useCallbackBindings.get(name);
          if (!binding || binding.node.arguments.length === 0) {
            continue;
          }

          // Count total references to this binding via scope analysis.
          // If there are references beyond the ones we flagged, the
          // useCallback may be justified (dep arrays, other hooks, etc.)
          const scope = context.sourceCode.getScope(binding.declarator);
          const variable = scope.variables.find(v => v.name === name);
          // references includes the declaration itself, so subtract 1
          const totalRefs = variable
            ? variable.references.filter(r => r.isRead()).length
            : 0;
          const flagged = flaggedRefCount.get(name) ?? 0;

          if (totalRefs > flagged) {
            continue;
          }

          const callNode = binding.node;
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

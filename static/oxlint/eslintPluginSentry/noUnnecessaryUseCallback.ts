import {AST_NODE_TYPES, ESLintUtils, type TSESTree} from '@typescript-eslint/utils';
import {getStaticValue} from '@typescript-eslint/utils/ast-utils';
import type {Scope} from '@typescript-eslint/utils/ts-eslint';

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
    // Maps scope Variable to the useCallback() CallExpression node and its declaring scope
    const useCallbackBindings = new Map<
      Scope.Variable,
      {declarator: TSESTree.VariableDeclarator; node: TSESTree.CallExpression}
    >();
    // Collected flagged usages per Variable
    const flaggedUsages = new Map<Scope.Variable, UsageInfo[]>();
    // Number of references we've accounted for (flagged) per Variable
    const flaggedRefCount = new Map<Scope.Variable, number>();
    // Local names imported from @sentry/scraps (these components are never memoized)
    const scrapsImports = new Set<string>();
    // Names that are aliased imports of useCallback (e.g. `import {useCallback as uc}`)
    const useCallbackNames = new Set(['useCallback']);

    /**
     * Resolve an Identifier node to its scope Variable, returning undefined
     * if the variable cannot be found.
     */
    function resolveVariable(node: TSESTree.Identifier): Scope.Variable | undefined {
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

    function addFlaggedUsage(variable: Scope.Variable, usage: UsageInfo) {
      let usages = flaggedUsages.get(variable);
      if (!usages) {
        usages = [];
        flaggedUsages.set(variable, usages);
      }
      usages.push(usage);
      flaggedRefCount.set(
        variable,
        (flaggedRefCount.get(variable) ?? 0) +
          1 /* each usage accounts for one reference to the binding */
      );
    }

    /**
     * Walks an AST node looking for a CallExpression whose callee is a
     * tracked useCallback binding. Returns the Variable if found.
     * Uses visitorKeys to avoid circular parent references.
     */
    function findCallToBinding(node: TSESTree.Node): Scope.Variable | null {
      if (
        node.type === AST_NODE_TYPES.CallExpression &&
        node.callee.type === AST_NODE_TYPES.Identifier
      ) {
        const variable = resolveVariable(node.callee);
        if (variable && useCallbackBindings.has(variable)) {
          return variable;
        }
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
        if (typeof source !== 'string') {
          return;
        }

        // Track aliased useCallback imports
        if (source === 'react') {
          for (const spec of node.specifiers) {
            if (
              spec.type === AST_NODE_TYPES.ImportSpecifier &&
              spec.imported.type === AST_NODE_TYPES.Identifier &&
              spec.imported.name === 'useCallback' &&
              spec.local.name !== 'useCallback'
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
        if (node.id.type !== AST_NODE_TYPES.Identifier) {
          return;
        }
        if (
          node.init?.type === AST_NODE_TYPES.CallExpression &&
          node.init.callee.type === AST_NODE_TYPES.Identifier &&
          useCallbackNames.has(node.init.callee.name)
        ) {
          const variable = resolveVariable(node.id);
          if (variable) {
            useCallbackBindings.set(variable, {node: node.init, declarator: node});
          }
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
        // The arrow wrapper creates a new ref each render, defeating memoization.
        // The binding is referenced inside the arrow body — count as 1 reference.
        if (expr.type === AST_NODE_TYPES.ArrowFunctionExpression) {
          const calledVariable = findCallToBinding(expr.body);
          if (calledVariable) {
            addFlaggedUsage(calledVariable, {
              reason: 'directlyInvoked',
              line: node.value.loc.start.line,
            });
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
        if (expr.type === AST_NODE_TYPES.Identifier) {
          const variable = resolveVariable(expr);
          if (!variable || !useCallbackBindings.has(variable)) {
            return;
          }

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
            addFlaggedUsage(variable, {
              reason: 'intrinsicElement',
              element: tagName.name,
              line: node.value.loc.start.line,
            });
          } else if (elementName && scrapsImports.has(elementName)) {
            addFlaggedUsage(variable, {
              reason: 'unmemoizedComponent',
              element: elementName,
              line: node.value.loc.start.line,
            });
          }
        }
      },

      'Program:exit'() {
        for (const [variable, usages] of flaggedUsages) {
          const binding = useCallbackBindings.get(variable);
          if (!binding || binding.node.arguments.length === 0) {
            continue;
          }

          // Count total references to this binding via scope analysis.
          // If there are references beyond the ones we flagged, the
          // useCallback may be justified (dep arrays, other hooks, etc.)
          const totalRefs = variable.references.filter(r => r.isRead()).length;
          const flagged = flaggedRefCount.get(variable) ?? 0;

          if (totalRefs > flagged) {
            continue;
          }

          const name = variable.name;
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

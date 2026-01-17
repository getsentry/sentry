const RENDER_HOOK_FNS = ['renderHook', 'renderHookWithProviders'];

/**
 * @type {import('eslint').Rule.RuleModule}
 */
const noRenderHookArrowFunction = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow passing anonymous arrow functions to renderHook() when initialProps should be used instead',
      recommended: true,
    },
    schema: [],
    messages: {
      unnecessaryArrowFunction:
        'Pass the hook directly and use initialProps for arguments: renderHook({{hookName}}, {initialProps: {{props}}})',
      arrowFunctionWithoutParams:
        'Pass the hook directly instead of wrapping it in an arrow function: renderHook({{hookName}})',
    },
    fixable: 'code',
  },

  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;

        // Check if it's renderHook or renderHookWithProviders
        if (!callee || callee.type !== 'Identifier') return;
        if (!RENDER_HOOK_FNS.includes(callee.name)) return;
        if (node.arguments.length === 0) return;

        const firstArg = node.arguments[0];

        // Check if the first argument is an arrow function
        if (firstArg.type !== 'ArrowFunctionExpression') return;

        const arrowFn = firstArg;
        const arrowParams = arrowFn.params;

        // Get the body of the arrow function
        let body = arrowFn.body;

        // If body is a block statement, get the return statement
        if (body.type === 'BlockStatement') {
          const returnStatement = body.body.find(stmt => stmt.type === 'ReturnStatement');
          if (!returnStatement?.argument) return;
          body = returnStatement.argument;
        }

        // Check if the body is a call expression (calling a hook)
        if (body.type !== 'CallExpression') return;

        const hookCall = body;
        const hookCallee = hookCall.callee;

        // Get the hook name
        let hookName = '';
        if (hookCallee.type === 'Identifier') {
          hookName = hookCallee.name;
        } else if (
          hookCallee.type === 'MemberExpression' &&
          hookCallee.property.type === 'Identifier'
        ) {
          hookName = context.sourceCode.getText(hookCallee);
        } else {
          return;
        }

        // Check if the arrow function doesn't use its parameters
        // If it has no parameters, it's definitely unnecessary
        if (arrowParams.length === 0) {
          context.report({
            node: firstArg,
            messageId: 'arrowFunctionWithoutParams',
            data: {
              hookName,
            },
            fix(fixer) {
              // Simple case: no arguments to the hook
              if (hookCall.arguments.length === 0) {
                return fixer.replaceText(firstArg, hookName);
              }

              // Complex case: hook has arguments that should become initialProps
              const hookArgs = hookCall.arguments.map(arg =>
                context.sourceCode.getText(arg)
              );

              // Format initialProps value
              // Single argument: initialProps: foo
              // Multiple arguments: initialProps: [foo, bar]
              const initialPropsValue =
                hookArgs.length === 1 ? hookArgs[0] : `[${hookArgs.join(', ')}]`;

              const secondArg = node.arguments[1];

              if (!secondArg) {
                // No second argument exists, create one
                return [
                  fixer.replaceText(firstArg, hookName),
                  fixer.insertTextAfter(
                    firstArg,
                    `, {initialProps: ${initialPropsValue}}`
                  ),
                ];
              }
              if (secondArg.type === 'ObjectExpression') {
                // Second argument is an object, check if initialProps already exists
                const hasInitialProps = secondArg.properties.some(
                  prop =>
                    prop.type === 'Property' &&
                    prop.key.type === 'Identifier' &&
                    prop.key.name === 'initialProps'
                );

                if (!hasInitialProps) {
                  // Add initialProps to the object
                  const lastProp = secondArg.properties[secondArg.properties.length - 1];
                  return [
                    fixer.replaceText(firstArg, hookName),
                    lastProp
                      ? fixer.insertTextAfter(
                          lastProp,
                          `, initialProps: ${initialPropsValue}`
                        )
                      : fixer.insertTextAfterRange(
                          [secondArg.range[0], secondArg.range[0] + 1],
                          `initialProps: ${initialPropsValue}, `
                        ),
                  ];
                }
              }

              // Can't auto-fix if we can't determine how to handle existing second argument
              return fixer.replaceText(firstArg, hookName);
            },
          });
          return;
        }

        // If the arrow function has parameters, check if they're actually used
        const arrowParamNames = arrowParams
          .map(param => {
            if (param.type === 'Identifier') {
              return param.name;
            }
            return null;
          })
          .filter(Boolean);

        // Check if any of the arrow function parameters are used in the hook call
        const usesArrowParams = hookCall.arguments.some(arg => {
          return containsIdentifier(arg, arrowParamNames);
        });

        // If the arrow function parameters are used in the hook call, this is the correct pattern
        // e.g., renderHook(p => useHotkeys(p), {initialProps: [...]})
        if (usesArrowParams) {
          return;
        }

        // If we get here, the arrow function has parameters but doesn't use them
        // This is the incorrect pattern
        const hookArgs = hookCall.arguments.map(arg => context.sourceCode.getText(arg));
        const propsText = hookArgs.length > 0 ? hookArgs.join(', ') : '...';

        context.report({
          node: firstArg,
          messageId: 'unnecessaryArrowFunction',
          data: {
            hookName,
            props: propsText,
          },
          fix(fixer) {
            // Same fix logic as above
            if (hookCall.arguments.length === 0) {
              return fixer.replaceText(firstArg, hookName);
            }

            const hookArgsForFix = hookCall.arguments.map(arg =>
              context.sourceCode.getText(arg)
            );
            const initialPropsValue =
              hookArgsForFix.length === 1
                ? hookArgsForFix[0]
                : `[${hookArgsForFix.join(', ')}]`;

            const secondArg = node.arguments[1];

            if (!secondArg) {
              return [
                fixer.replaceText(firstArg, hookName),
                fixer.insertTextAfter(firstArg, `, {initialProps: ${initialPropsValue}}`),
              ];
            }

            return fixer.replaceText(firstArg, hookName);
          },
        });
      },
    };
  },
};

/**
 * Check if an AST node contains an identifier with one of the given names
 */
function containsIdentifier(node, names) {
  if (!node) return false;

  if (node.type === 'Identifier') {
    return names.includes(node.name);
  }

  // Recursively check all properties of the node
  for (const key in node) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;

    const value = node[key];

    if (Array.isArray(value)) {
      if (value.some(item => containsIdentifier(item, names))) {
        return true;
      }
    } else if (value && typeof value === 'object') {
      if (containsIdentifier(value, names)) {
        return true;
      }
    }
  }

  return false;
}

export default noRenderHookArrowFunction;

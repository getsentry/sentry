const RENDER_HOOK_FNS = ['renderHook', 'renderHookWithProviders'];

/**
 * Type guard to check if a node is an Identifier
 * @param {import('estree').Node | null | undefined} node
 * @returns {node is import('estree').Identifier}
 */
function isIdentifier(node) {
  return node?.type === 'Identifier';
}

/**
 * Type guard to check if a node is a CallExpression
 * @param {import('estree').Node | null | undefined} node
 * @returns {node is import('estree').CallExpression}
 */
function isCallExpression(node) {
  return node?.type === 'CallExpression';
}

/**
 * Type guard to check if a node is an ObjectExpression
 * @param {import('estree').Node | null | undefined} node
 * @returns {node is import('estree').ObjectExpression}
 */
function isObjectExpression(node) {
  return node?.type === 'ObjectExpression';
}

/**
 * Type guard to check if a node is a BlockStatement
 * @param {import('estree').Node | null | undefined} node
 * @returns {node is import('estree').BlockStatement}
 */
function isBlockStatement(node) {
  return node?.type === 'BlockStatement';
}

/**
 * Type guard to check if a node is a ReturnStatement
 * @param {import('estree').Statement} node
 * @returns {node is import('estree').ReturnStatement}
 */
function isReturnStatement(node) {
  return node.type === 'ReturnStatement';
}

/**
 * Type guard to check if a node is a MemberExpression
 * @param {import('estree').Node | null | undefined} node
 * @returns {node is import('estree').MemberExpression}
 */
function isMemberExpression(node) {
  return node?.type === 'MemberExpression';
}

/**
 * Type guard to check if a Property has an Identifier key
 * @param {import('estree').Property | import('estree').SpreadElement} prop
 * @returns {prop is import('estree').Property & {key: import('estree').Identifier}}
 */
function isPropertyWithIdentifierKey(prop) {
  return prop.type === 'Property' && prop.key.type === 'Identifier';
}

/**
 * Type guard to check if a node is an ImportDeclaration
 * @param {import('estree').ModuleDeclaration | import('estree').Statement | import('estree').Directive} node
 * @returns {node is import('estree').ImportDeclaration}
 */
function isImportDeclaration(node) {
  return node.type === 'ImportDeclaration';
}

/**
 * Type guard to check if an import specifier is an ImportSpecifier with Identifier imported name
 * @param {import('estree').ImportSpecifier | import('estree').ImportDefaultSpecifier | import('estree').ImportNamespaceSpecifier} spec
 * @returns {spec is import('estree').ImportSpecifier & {imported: import('estree').Identifier}}
 */
function isImportSpecifierWithIdentifier(spec) {
  return spec.type === 'ImportSpecifier' && spec.imported.type === 'Identifier';
}

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
      useComponentRenderInstead:
        'Convert to a component render() test instead of using renderHook() with multiple statements',
    },
    fixable: 'code',
  },

  /**
   * @param {import('eslint').Rule.RuleContext} context
   * @returns {import('eslint').Rule.RuleListener}
   */
  create(context) {
    return {
      /**
       * @param {import('estree').CallExpression} node
       */
      // @ts-expect-error - Type mismatch between estree versions (ESLint adds NodeParentExtension)
      CallExpression(node) {
        const callee = node.callee;

        // Check if it's renderHook or renderHookWithProviders
        if (!isIdentifier(callee)) return;
        if (!RENDER_HOOK_FNS.includes(callee.name)) return;
        if (node.arguments.length === 0) return;

        const firstArg = node.arguments[0];
        if (!firstArg) return;

        // Check if the first argument is an arrow function
        if (firstArg.type !== 'ArrowFunctionExpression') return;

        const arrowFn = firstArg;
        const arrowParams = arrowFn.params;

        // Get the body of the arrow function
        let body = arrowFn.body;

        // If body is a block statement, check for multiple statements
        if (isBlockStatement(body)) {
          // Count non-return statements
          const nonReturnStatements = body.body.filter(stmt => !isReturnStatement(stmt));

          // If there are multiple statements (besides the return), suggest component render
          if (nonReturnStatements.length > 0) {
            context.report({
              node: firstArg,
              messageId: 'useComponentRenderInstead',
              /**
               * @param {import('eslint').Rule.RuleFixer} fixer
               * @returns {import('eslint').Rule.Fix[]}
               */
              fix(fixer) {
                // Generate a unique component name based on the hook name if we can find it
                // @ts-expect-error - body is narrowed to BlockStatement but TS doesn't recognize it
                const returnStatement = body.body.find(isReturnStatement);
                let componentName = 'TestComponent';

                if (isCallExpression(returnStatement?.argument)) {
                  const hookCallee = returnStatement.argument.callee;
                  if (isIdentifier(hookCallee)) {
                    // Convert useMyHook -> MyHook
                    componentName = hookCallee.name.replace(/^use/, '');
                  }
                }

                // Get the entire renderHook call statement for proper indentation
                const renderHookCallNode = node;
                const sourceCode = context.sourceCode;

                // Find the statement node that contains the renderHook call
                let statementNode = renderHookCallNode;
                // @ts-expect-error - parent property exists on ESLint AST nodes
                while (statementNode.parent && statementNode.parent.type !== 'Program') {
                  // @ts-expect-error - parent property exists on ESLint AST nodes
                  if (statementNode.parent.type === 'ExpressionStatement') {
                    // @ts-expect-error - parent property exists on ESLint AST nodes
                    statementNode = statementNode.parent;
                    break;
                  }
                  // @ts-expect-error - parent property exists on ESLint AST nodes
                  statementNode = statementNode.parent;
                }

                // Get the indentation of the current line
                const lineStart = sourceCode.getIndexFromLoc({
                  // @ts-expect-error - statementNode.loc could be null but we verify it exists
                  line: statementNode.loc.start.line,
                  column: 0,
                });
                // @ts-expect-error - statementNode.range could be undefined but we verify it exists
                const statementStart = statementNode.range[0];
                const indentation = sourceCode.text.slice(lineStart, statementStart);

                // Extract statements from the body and rebuild with correct indentation
                // @ts-expect-error - body is narrowed to BlockStatement but TS doesn't recognize it
                const bodyStatements = body.body.map(stmt => {
                  const stmtText = sourceCode.getText(stmt);
                  return `${indentation}  ${stmtText}`;
                });

                // Build the component function
                const componentDef = `function ${componentName}() {\n${bodyStatements.join('\n')}\n${indentation}}\n${indentation}`;

                // Replace the entire renderHook call with render call
                const renderCall = `render(<${componentName} />)`;

                const fixes = [
                  // @ts-expect-error - Type mismatch between estree versions
                  fixer.insertTextBefore(statementNode, componentDef),
                  // @ts-expect-error - Type mismatch between estree versions
                  fixer.replaceText(renderHookCallNode, renderCall),
                ];

                // Check if we need to add the render import
                const importFix = ensureRenderImport(context, sourceCode, fixer);
                if (importFix) {
                  fixes.unshift(importFix);
                }

                return fixes;
              },
            });
            return;
          }

          // Single statement block - get the return statement
          const returnStatement = body.body.find(isReturnStatement);
          if (!returnStatement?.argument) return;
          body = returnStatement.argument;
        }

        // Check if the body is a call expression (calling a hook)
        if (!isCallExpression(body)) return;

        const hookCall = body;
        const hookCallee = hookCall.callee;

        // Get the hook name
        let hookName = '';
        if (isIdentifier(hookCallee)) {
          hookName = hookCallee.name;
        } else if (isMemberExpression(hookCallee) && isIdentifier(hookCallee.property)) {
          // @ts-expect-error - Type mismatch between estree versions
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
            /**
             * @param {import('eslint').Rule.RuleFixer} fixer
             * @returns {import('eslint').Rule.Fix | import('eslint').Rule.Fix[] | null}
             */
            fix(fixer) {
              // Auto-fix when hook has zero arguments
              if (hookCall.arguments.length === 0) {
                // @ts-expect-error - Type mismatch between estree versions
                return fixer.replaceText(firstArg, hookName);
              }

              // Auto-fix when hook has exactly one argument
              if (hookCall.arguments.length === 1) {
                // @ts-expect-error - Type mismatch between estree versions
                const hookArg = context.sourceCode.getText(hookCall.arguments[0]);
                const secondArg = node.arguments[1];

                if (!secondArg) {
                  // No second argument exists, create one
                  return [
                    // @ts-expect-error - Type mismatch between estree versions
                    fixer.replaceText(firstArg, hookName),
                    // @ts-expect-error - Type mismatch between estree versions
                    fixer.insertTextAfter(firstArg, `, {initialProps: ${hookArg}}`),
                  ];
                }

                if (isObjectExpression(secondArg)) {
                  // Second argument is an object, check if initialProps already exists
                  const hasInitialProps = secondArg.properties.some(
                    prop =>
                      isPropertyWithIdentifierKey(prop) &&
                      prop.key.name === 'initialProps'
                  );

                  if (!hasInitialProps) {
                    // Add initialProps to the object
                    const lastProp =
                      secondArg.properties[secondArg.properties.length - 1];
                    return [
                      // @ts-expect-error - Type mismatch between estree versions
                      fixer.replaceText(firstArg, hookName),
                      lastProp
                        ? // @ts-expect-error - Type mismatch between estree versions
                          fixer.insertTextAfter(lastProp, `, initialProps: ${hookArg}`)
                        : fixer.insertTextAfterRange(
                            // @ts-expect-error - range could be undefined but we verify it exists
                            [secondArg.range[0], secondArg.range[0] + 1],
                            `initialProps: ${hookArg}, `
                          ),
                    ];
                  }
                }
              }

              // Don't auto-fix for multiple arguments - requires manual intervention
              return null;
            },
          });
          return;
        }

        // If the arrow function has parameters, check if they're actually used
        /** @type {string[]} */
        const arrowParamNames = [];
        for (const param of arrowParams) {
          extractIdentifierNames(param, arrowParamNames);
        }

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
        const hookArgs = hookCall.arguments.map(arg =>
          // @ts-expect-error - Type mismatch between estree versions
          context.sourceCode.getText(arg)
        );
        const propsText = hookArgs.length > 0 ? hookArgs.join(', ') : '...';

        context.report({
          node: firstArg,
          messageId: 'unnecessaryArrowFunction',
          data: {
            hookName,
            props: propsText,
          },
          /**
           * @param {import('eslint').Rule.RuleFixer} fixer
           * @returns {import('eslint').Rule.Fix | import('eslint').Rule.Fix[] | null}
           */
          fix(fixer) {
            // Auto-fix when hook has zero arguments
            if (hookCall.arguments.length === 0) {
              // @ts-expect-error - Type mismatch between estree versions
              return fixer.replaceText(firstArg, hookName);
            }

            // Auto-fix when hook has exactly one argument
            if (hookCall.arguments.length === 1) {
              // @ts-expect-error - Type mismatch between estree versions
              const hookArg = context.sourceCode.getText(hookCall.arguments[0]);
              const secondArg = node.arguments[1];

              if (!secondArg) {
                // No second argument exists, create one
                return [
                  // @ts-expect-error - Type mismatch between estree versions
                  fixer.replaceText(firstArg, hookName),
                  // @ts-expect-error - Type mismatch between estree versions
                  fixer.insertTextAfter(firstArg, `, {initialProps: ${hookArg}}`),
                ];
              }

              if (isObjectExpression(secondArg)) {
                // Second argument is an object, check if initialProps already exists
                const hasInitialProps = secondArg.properties.some(
                  prop =>
                    isPropertyWithIdentifierKey(prop) && prop.key.name === 'initialProps'
                );

                if (!hasInitialProps) {
                  // Add initialProps to the object
                  const lastProp = secondArg.properties[secondArg.properties.length - 1];
                  return [
                    // @ts-expect-error - Type mismatch between estree versions
                    fixer.replaceText(firstArg, hookName),
                    lastProp
                      ? // @ts-expect-error - Type mismatch between estree versions
                        fixer.insertTextAfter(lastProp, `, initialProps: ${hookArg}`)
                      : fixer.insertTextAfterRange(
                          // @ts-expect-error - range could be undefined but we verify it exists
                          [secondArg.range[0], secondArg.range[0] + 1],
                          `initialProps: ${hookArg}, `
                        ),
                  ];
                }
              }
            }

            // Don't auto-fix for multiple arguments - requires manual intervention
            return null;
          },
        });
      },
    };
  },
};

/**
 * Extract all identifier names from a parameter pattern
 * Handles simple identifiers, object destructuring, and array destructuring
 * @param {import('estree').Pattern | null | undefined} param - The parameter pattern to extract from
 * @param {string[]} names - Array to collect identifier names into
 * @returns {void}
 */
function extractIdentifierNames(param, names) {
  if (!param) return;

  if (param.type === 'Identifier') {
    names.push(param.name);
  } else if (param.type === 'ObjectPattern') {
    // Handle object destructuring like {fact, dep} or {a: b, c}
    for (const prop of param.properties) {
      if (prop.type === 'Property') {
        extractIdentifierNames(prop.value, names);
      } else if (prop.type === 'RestElement') {
        extractIdentifierNames(prop.argument, names);
      }
    }
  } else if (param.type === 'ArrayPattern') {
    // Handle array destructuring like [a, b]
    for (const element of param.elements) {
      if (element) {
        extractIdentifierNames(element, names);
      }
    }
  } else if (param.type === 'RestElement') {
    // Handle rest parameters like ...rest
    extractIdentifierNames(param.argument, names);
  } else if (param.type === 'AssignmentPattern') {
    // Handle default parameters like a = 5
    extractIdentifierNames(param.left, names);
  }
}

/**
 * Check if an AST node contains an identifier with one of the given names
 * @param {import('estree').Node | null | undefined} node - The AST node to check
 * @param {string[]} names - Array of identifier names to look for
 * @returns {boolean} True if any of the names are found in the node tree
 */
function containsIdentifier(node, names) {
  if (!node) return false;

  if (node.type === 'Identifier') {
    return names.includes(node.name);
  }

  // Recursively check all properties of the node
  for (const key in node) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;

    // @ts-expect-error - Dynamic property access on AST node
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

/**
 * Ensure that 'render' is imported from 'sentry-test/reactTestingLibrary'
 * Returns a Fix object if an import needs to be added, null otherwise
 * @param {import('eslint').Rule.RuleContext} _context - The rule context
 * @param {import('eslint').SourceCode} sourceCode - The source code object
 * @param {import('eslint').Rule.RuleFixer} fixer - The fixer object
 * @returns {import('eslint').Rule.Fix | null} A fix to add the import, or null if not needed
 */
function ensureRenderImport(_context, sourceCode, fixer) {
  const TESTING_LIBRARY_MODULE = 'sentry-test/reactTestingLibrary';
  const ast = sourceCode.ast;

  // Find all import declarations
  // @ts-expect-error - Type guard should narrow but type system doesn't recognize it
  const imports = ast.body.filter(isImportDeclaration);

  // Check if there's already an import from sentry-test/reactTestingLibrary
  const testingLibraryImport = imports.find(
    node => node.source.value === TESTING_LIBRARY_MODULE
  );

  if (testingLibraryImport) {
    // Check if 'render' is already imported
    const hasRenderImport = testingLibraryImport.specifiers.some(
      spec => isImportSpecifierWithIdentifier(spec) && spec.imported.name === 'render'
    );

    if (hasRenderImport) {
      // Already imported, no fix needed
      return null;
    }

    // Add 'render' to the existing import
    // Find the last specifier to add after it
    const lastSpecifier =
      testingLibraryImport.specifiers[testingLibraryImport.specifiers.length - 1];

    if (lastSpecifier) {
      return fixer.insertTextAfter(lastSpecifier, ', render');
    }
  }

  // No import from sentry-test/reactTestingLibrary exists, create a new one
  // Find the position to insert (after the last import, or at the beginning)
  const lastImport = imports[imports.length - 1];

  if (lastImport) {
    return fixer.insertTextAfter(
      lastImport,
      `\nimport {render} from '${TESTING_LIBRARY_MODULE}';`
    );
  }

  // No imports at all, insert at the beginning of the file
  const firstNode = ast.body[0];
  if (firstNode) {
    return fixer.insertTextBefore(
      firstNode,
      `import {render} from '${TESTING_LIBRARY_MODULE}';\n\n`
    );
  }

  return null;
}

export default noRenderHookArrowFunction;

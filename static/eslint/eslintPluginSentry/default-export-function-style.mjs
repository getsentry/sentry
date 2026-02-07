/**
 * Enforces consistent style for default exports of functions and classes.
 *
 * Two modes:
 * - "statement" (default): Prefer `export default function foo() {}`
 * - "inline": Prefer `const foo = () => {}; export default foo;`
 *
 * @type {import('eslint').Rule.RuleModule}
 */
const defaultExportFunctionStyle = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Enforce consistent style for default exports of functions and classes',
      recommended: false,
    },
    fixable: 'code',
    schema: [
      {
        type: 'string',
        enum: ['statement', 'inline'],
        default: 'statement',
      },
    ],
    messages: {
      preferStatement:
        'Prefer `export default {{type}} {{name}}()` over separate declaration and export',
      preferInline:
        'Prefer separate declaration and `export default {{name}}` over inline export',
    },
  },

  /**
   * @param {import('eslint').Rule.RuleContext} context
   * @returns {import('eslint').Rule.RuleListener}
   */
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    /** @type {'statement' | 'inline'} */
    const mode = context.options[0] || 'statement';
    /** @type {Map<string, import('estree').FunctionDeclaration | import('estree').ClassDeclaration>} */
    const declarations = new Map();
    /** @type {Map<string, {declarator: import('estree').VariableDeclarator, declaration: import('estree').VariableDeclaration}>} */
    const variableDeclarations = new Map();

    return {
      // Track function and class declarations
      /**
       * @param {import('estree').FunctionDeclaration | import('estree').ClassDeclaration} node
       */
      'FunctionDeclaration, ClassDeclaration'(node) {
        if (node.id?.name) {
          declarations.set(node.id.name, node);
        }
      },

      // Track variable declarations (for const/let/var with functions/arrows)
      /**
       * @param {import('estree').VariableDeclarator} node
       */
      VariableDeclarator(node) {
        if (
          node.id.type === 'Identifier' &&
          (node.init?.type === 'FunctionExpression' ||
            node.init?.type === 'ArrowFunctionExpression')
        ) {
          // Store both the declarator and its parent declaration
          const declaration = /** @type {import('estree').VariableDeclaration} */ (
            node.parent
          );
          variableDeclarations.set(node.id.name, {declarator: node, declaration});
        }
      },

      // Check export default statements
      /**
       * @param {import('estree').ExportDefaultDeclaration} node
       */
      ExportDefaultDeclaration(node) {
        if (mode === 'statement') {
          handleStatementMode(
            node,
            declarations,
            variableDeclarations,
            context,
            sourceCode
          );
        } else {
          handleInlineMode(node, context, sourceCode);
        }
      },
    };
  },
};

/**
 * "statement" mode: Enforce `export default function foo() {}`
 * Fail: separate declaration + export
 * Pass: inline export declaration
 *
 * @param {import('estree').ExportDefaultDeclaration} node
 * @param {Map<string, import('estree').FunctionDeclaration | import('estree').ClassDeclaration>} declarations
 * @param {Map<string, {declarator: import('estree').VariableDeclarator, declaration: import('estree').VariableDeclaration}>} variableDeclarations
 * @param {import('eslint').Rule.RuleContext} context
 * @param {import('eslint').SourceCode} sourceCode
 */
function handleStatementMode(
  node,
  declarations,
  variableDeclarations,
  context,
  sourceCode
) {
  // Case 1: export default Identifier (separate export)
  if (node.declaration.type === 'Identifier') {
    const exportedName = node.declaration.name;

    // Check for function/class declarations
    const declarationNode = declarations.get(exportedName);
    if (declarationNode) {
      // Don't report if the declaration has JSDoc comments
      const comments = sourceCode.getCommentsBefore(declarationNode);
      if (
        comments.some(
          comment => comment.type === 'Block' && comment.value.startsWith('*')
        )
      ) {
        return;
      }

      const declarationType =
        declarationNode.type === 'FunctionDeclaration' ? 'function' : 'class';

      context.report({
        node,
        messageId: 'preferStatement',
        data: {
          type: declarationType,
          name: exportedName,
        },
        fix(fixer) {
          const declarationText = sourceCode.getText(declarationNode);
          const keywordLength = declarationType.length + 1;
          const signatureText = declarationText.slice(keywordLength);
          const inlineExport = `export default ${declarationType} ${signatureText}`;

          return [fixer.replaceText(declarationNode, inlineExport), fixer.remove(node)];
        },
      });
      return;
    }

    // Check for variable declarations with function expressions or arrow functions
    const varDecl = variableDeclarations.get(exportedName);
    if (varDecl) {
      const {declarator, declaration} = varDecl;
      const isArrowFunction = declarator.init.type === 'ArrowFunctionExpression';
      const isFunctionExpression = declarator.init.type === 'FunctionExpression';

      if (isArrowFunction || isFunctionExpression) {
        // Don't report if the declaration has JSDoc comments
        const comments = sourceCode.getCommentsBefore(declaration);
        if (
          comments.some(
            comment => comment.type === 'Block' && comment.value.startsWith('*')
          )
        ) {
          return;
        }

        context.report({
          node,
          messageId: 'preferStatement',
          data: {
            type: 'function',
            name: exportedName,
          },
          fix(fixer) {
            // Convert `const foo = () => {}` or `const foo = function() {}`
            // to `export default function foo() {}`
            const functionNode = declarator.init;
            const params = sourceCode.getText(
              functionNode.params?.[0]?.parent ?? functionNode
            );
            const paramsMatch = params.match(/\((.*?)\)/);
            const paramsText = paramsMatch ? paramsMatch[1] : '';

            /** @type {string} */
            let bodyText = '';
            if (functionNode.body.type === 'BlockStatement') {
              bodyText = sourceCode.getText(functionNode.body);
            } else {
              // Arrow function with expression body
              bodyText = `{ return ${sourceCode.getText(functionNode.body)}; }`;
            }

            const inlineExport = `export default function ${exportedName}(${paramsText}) ${bodyText}`;

            return [fixer.replaceText(declaration, inlineExport), fixer.remove(node)];
          },
        });
      }
    }
  }
}

/**
 * "inline" mode: Enforce separate declaration and export
 * Fail: `export default function foo() {}`
 * Pass: `function foo() {}; export default foo;`
 *
 * @param {import('estree').ExportDefaultDeclaration} node
 * @param {import('eslint').Rule.RuleContext} context
 * @param {import('eslint').SourceCode} sourceCode
 */
function handleInlineMode(node, context, sourceCode) {
  // Only report inline function/class declarations
  if (
    node.declaration.type === 'FunctionDeclaration' ||
    node.declaration.type === 'ClassDeclaration'
  ) {
    const name = node.declaration.id?.name;
    if (!name) {
      // Anonymous exports are not applicable to this rule
      return;
    }

    // Don't report if the declaration has JSDoc comments
    const comments = sourceCode.getCommentsBefore(node);
    if (
      comments.some(comment => comment.type === 'Block' && comment.value.startsWith('*'))
    ) {
      return;
    }

    const declarationType =
      node.declaration.type === 'FunctionDeclaration' ? 'function' : 'class';

    context.report({
      node,
      messageId: 'preferInline',
      data: {
        type: declarationType,
        name,
      },
      fix(fixer) {
        // Convert `export default function foo() {}` to `function foo() {}` + `export default foo;`
        const declarationText = sourceCode.getText(node.declaration);
        const exportStatement = `export default ${name};`;

        return fixer.replaceText(node, `${declarationText}\n${exportStatement}`);
      },
    });
  }
}

export default defaultExportFunctionStyle;

/**
 * @file Value decomposition for style expressions.
 *
 * Extracts all possible values from complex expressions like ternaries,
 * logical expressions, and nested member expressions.
 */

/**
 * Decompose an expression into all possible StyleValue entries.
 *
 * @param {import('estree').Node} node
 * @param {import('./types.mjs').ThemeTracker} themeTracker
 * @returns {import('./types.mjs').StyleValue[]}
 */
export function decomposeValue(node, themeTracker) {
  /** @type {import('./types.mjs').StyleValue[]} */
  const values = [];

  collectValues(node, values, themeTracker);

  return values;
}

/**
 * Recursively collect values from an expression.
 *
 * @param {import('estree').Node} node
 * @param {import('./types.mjs').StyleValue[]} values
 * @param {import('./types.mjs').ThemeTracker} themeTracker
 */
function collectValues(node, values, themeTracker) {
  if (!node || typeof node !== 'object') {
    return;
  }

  switch (node.type) {
    case 'ConditionalExpression':
      // Ternary: condition ? consequent : alternate
      // Both branches are possible values
      collectValues(node.consequent, values, themeTracker);
      collectValues(node.alternate, values, themeTracker);
      break;

    case 'LogicalExpression':
      // foo || bar, foo && bar
      // Both operands are potential values
      collectValues(node.left, values, themeTracker);
      collectValues(node.right, values, themeTracker);
      break;

    case 'MemberExpression':
      // Check if this is a theme token reference
      values.push(createMemberValue(node, themeTracker));
      break;

    case 'Literal':
      values.push({
        node,
        kind: 'literal',
        confident: true,
        tokenInfo: null,
      });
      break;

    case 'TemplateLiteral':
      // Template literals might contain interpolations
      if (node.expressions.length === 0) {
        values.push({
          node,
          kind: 'template-quasi',
          confident: true,
          tokenInfo: null,
        });
      } else {
        // Has interpolations - check each expression
        for (const expr of node.expressions) {
          collectValues(expr, values, themeTracker);
        }
      }
      break;

    case 'CallExpression':
      values.push({
        node,
        kind: 'call',
        confident: false,
        tokenInfo: null,
      });
      break;

    case 'ArrowFunctionExpression':
      // Arrow functions like `p => p.theme.tokens.content.primary`
      // Need to analyze the body/return value
      if (node.expression && node.body) {
        // Implicit return: (p) => p.theme.tokens...
        // Register the parameter as a potential theme binding
        const param = node.params[0];
        if (param?.type === 'Identifier') {
          themeTracker.registerCallbackBinding(param.name, node);
        }
        collectValues(
          /** @type {import('estree').Node} */ (node.body),
          values,
          themeTracker
        );
      }
      break;

    case 'Identifier':
      // Could be a variable reference - would need scope analysis
      values.push({
        node,
        kind: 'unknown',
        confident: false,
        tokenInfo: null,
      });
      break;

    default:
      values.push({
        node,
        kind: 'unknown',
        confident: false,
        tokenInfo: null,
      });
  }
}

/**
 * Create a StyleValue for a MemberExpression, extracting token info if present.
 *
 * @param {import('estree').MemberExpression} node
 * @param {import('./types.mjs').ThemeTracker} themeTracker
 * @returns {import('./types.mjs').StyleValue}
 */
function createMemberValue(node, themeTracker) {
  const tokenInfo = extractTokenInfo(node, themeTracker);
  return {
    node,
    kind: 'member',
    confident: tokenInfo !== null,
    tokenInfo,
  };
}

/**
 * Extract token information from a MemberExpression if it's a theme token.
 *
 * @param {import('estree').MemberExpression} node
 * @param {import('./types.mjs').ThemeTracker} themeTracker
 * @returns {import('./types.mjs').TokenInfo | null}
 */
function extractTokenInfo(node, themeTracker) {
  /** @type {string[]} */
  const pathParts = [];
  /** @type {import('estree').Node} */
  let current = node;

  // Walk up the member expression chain
  while (current.type === 'MemberExpression' && current.property?.type === 'Identifier') {
    pathParts.unshift(current.property.name);
    current = current.object;
  }

  // Check the base identifier
  if (current.type === 'Identifier') {
    pathParts.unshift(current.name);
  }

  const tokensIndex = pathParts.indexOf('tokens');
  if (tokensIndex === -1 || tokensIndex >= pathParts.length - 1) {
    return null;
  }

  // Verify the base is a known theme binding or common convention
  const base = pathParts[0];
  if (!base) {
    return null;
  }
  const hasThemeInPath = pathParts.includes('theme');
  const isKnownBinding = themeTracker.isThemeBinding(base);
  const isCommonConvention = ['theme', 'p', 't'].includes(base);

  if (!isKnownBinding && !isCommonConvention && !hasThemeInPath) {
    return null;
  }

  const tokenPath = pathParts.slice(tokensIndex + 1).join('.');
  const tokenName = pathParts[pathParts.length - 1];
  if (!tokenName) {
    return null;
  }

  return {
    tokenPath,
    tokenName,
    node,
  };
}

/**
 * ESLint rule: use-semantic-token
 *
 * Enforces that theme.tokens.content.* tokens are only used with
 * CSS color properties (color, text-decoration-color, etc.)
 */

/**
 * Set of CSS properties that are valid for content tokens
 * @type {Set<string>}
 */
const ALLOWED_COLOR_PROPERTIES = new Set([
  'color',
  'text-decoration-color',
  'caret-color',
  'column-rule-color',
  '-webkit-text-fill-color',
  '-webkit-text-stroke-color',
]);

/**
 * Pattern to detect theme.tokens.content.* references
 * Matches: theme.tokens.content.primary, p.theme.tokens.content.secondary, etc.
 */
const CONTENT_TOKEN_PATTERN = /(?:\bp\.|^)theme\.tokens\.content\.(\w+)/;

/**
 * Convert camelCase to kebab-case
 * @param {string} str
 * @returns {string}
 */
function camelToKebabCase(str) {
  return str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}

/**
 * Normalize property name to kebab-case for consistent lookup
 * @param {string} property
 * @returns {string}
 */
function normalizeProperty(property) {
  if (property.includes('-')) {
    return property.toLowerCase();
  }
  return camelToKebabCase(property);
}

/**
 * @type {import('eslint').Rule.RuleModule}
 */
const useSemanticToken = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce that theme.tokens.content.* tokens are only used with CSS color properties',
      category: 'Best Practices',
    },
    schema: [],
    messages: {
      invalidProperty:
        'Content token `theme.tokens.content.{{tokenName}}` should only be used with color properties (color, text-decoration-color, etc.). Found: `{{property}}`.',
    },
  },

  create(context) {
    /**
     * Extract content token name from a value string if it contains one
     * @param {string} value
     * @returns {string | null}
     */
    function extractContentToken(value) {
      const match = value.match(CONTENT_TOKEN_PATTERN);
      return match?.[1] ?? null;
    }

    /**
     * Check if a property is a valid color property for content tokens
     * @param {string} property
     * @returns {boolean}
     */
    function isValidColorProperty(property) {
      return ALLOWED_COLOR_PROPERTIES.has(normalizeProperty(property));
    }

    /**
     * Validate that a content token is used with an allowed property
     * @param {import('estree').Node} node
     * @param {string} property
     * @param {string} value
     * @param {import('estree').Node} [valueNode]
     */
    function validateContentToken(node, property, value, valueNode) {
      const tokenName = extractContentToken(value);
      if (!tokenName) {
        return; // Not a content token reference
      }

      const normalizedProperty = normalizeProperty(property);

      if (!isValidColorProperty(normalizedProperty)) {
        context.report({
          node: valueNode || node,
          messageId: 'invalidProperty',
          data: {
            tokenName,
            property: normalizedProperty,
          },
        });
      }
    }

    /**
     * Convert AST node to source code string
     * @param {any} node
     * @returns {string | null}
     */
    function nodeToString(node) {
      const sourceCode = context.sourceCode;
      if (!sourceCode) {
        return null;
      }

      try {
        return sourceCode.getText(node);
      } catch {
        return null;
      }
    }

    /**
     * Check if a node is within a style context (styled-components, css, style attr)
     * but NOT inside a JavaScript object used as a lookup table.
     * @param {import('estree').Node} node
     * @returns {boolean}
     */
    function isStyleContext(node) {
      /** @type {any} */
      let current = node;
      while (current.parent) {
        current = current.parent;

        // If this object is accessed via bracket notation (lookup table pattern),
        // it's not a direct style object - skip it
        // e.g., ({ none: theme.tokens.content.primary })[status]
        if (
          current.type === 'MemberExpression' &&
          current.computed === true &&
          current.object?.type === 'ObjectExpression'
        ) {
          return false;
        }

        // Check for styled-components or emotion patterns
        if (current.type === 'TaggedTemplateExpression') {
          const tag = current.tag;
          if (
            (tag.type === 'Identifier' && tag.name === 'css') ||
            (tag.type === 'MemberExpression' &&
              tag.object.type === 'Identifier' &&
              tag.object.name === 'styled') ||
            (tag.type === 'CallExpression' &&
              tag.callee.type === 'Identifier' &&
              tag.callee.name === 'styled')
          ) {
            return true;
          }
        }

        // Check for style={{ }} JSX attribute
        if (
          current.type === 'JSXAttribute' &&
          current.name?.type === 'JSXIdentifier' &&
          current.name.name === 'style'
        ) {
          return true;
        }

        // Check for css prop
        if (
          current.type === 'JSXAttribute' &&
          current.name?.type === 'JSXIdentifier' &&
          current.name.name === 'css'
        ) {
          return true;
        }
      }
      return false;
    }

    /**
     * Extract the CSS property name from CSS text that precedes an interpolation.
     * Must correctly handle nested selectors (a:hover) and only match actual properties.
     * @param {string} cssText
     * @returns {string | null}
     */
    function extractCssProperty(cssText) {
      // Match a CSS property declaration: property-name: value
      // The property must appear after {, ;, or at line start (with optional whitespace)
      // This avoids matching pseudo-selectors like a:hover
      //
      // Pattern breakdown:
      // (?:^|[{;])  - Start of string, or after { or ;
      // \s*         - Optional whitespace
      // ([a-z-]+)   - The property name (captured)
      // \s*:\s*     - Colon with optional whitespace
      // [^;{]*$     - Value part (no ; or { until end, meaning we're mid-declaration)
      const match = cssText.match(/(?:^|[{;])\s*([a-z-]+)\s*:\s*[^;{]*$/i);
      return match?.[1] ?? null;
    }

    /**
     * Parse CSS properties from template literal and check content token references
     * @param {any} templateNode
     */
    function checkTemplateLiteral(templateNode) {
      // Check interpolated expressions for theme/token references
      templateNode.expressions?.forEach(
        (/** @type {any} */ expr, /** @type {number} */ index) => {
          // Get the CSS property this expression is associated with
          // by looking at the preceding quasi text
          const precedingQuasi = templateNode.quasis[index];
          if (!precedingQuasi) {
            return;
          }

          const cssText = precedingQuasi.value.cooked || precedingQuasi.value.raw;
          if (!cssText) {
            return;
          }

          // Find the CSS property declaration before this expression
          const property = extractCssProperty(cssText);
          if (!property) {
            return;
          }

          // Convert expression AST to string for pattern matching
          const exprText = nodeToString(expr);
          if (!exprText) {
            return;
          }

          validateContentToken(expr, property, exprText, expr);
        }
      );
    }

    return {
      // Handle object properties (e.g., { color: theme.tokens.content.primary })
      Property(node) {
        if (!node.key || !node.value) {
          return;
        }

        // Only check properties that look like style declarations
        if (!isStyleContext(node)) {
          return;
        }

        const propertyName =
          node.key.type === 'Identifier'
            ? node.key.name
            : node.key.type === 'Literal'
              ? String(node.key.value)
              : null;

        if (!propertyName || typeof propertyName !== 'string') {
          return;
        }

        // Handle expression values (theme object references)
        const exprText = nodeToString(node.value);
        if (exprText) {
          validateContentToken(node, propertyName, exprText, node.value);
        }
      },

      // Handle CSS template literals (styled-components, emotion)
      TaggedTemplateExpression(node) {
        const tag = node.tag;

        // Check for css`` or styled.div`` or styled(Component)``
        const isStyled =
          (tag.type === 'Identifier' && tag.name === 'css') ||
          (tag.type === 'MemberExpression' &&
            ((tag.property.type === 'Identifier' && tag.property.name === 'css') ||
              (tag.object.type === 'Identifier' && tag.object.name === 'styled'))) ||
          (tag.type === 'CallExpression' &&
            tag.callee.type === 'Identifier' &&
            tag.callee.name === 'styled');

        if (!isStyled) {
          return;
        }

        checkTemplateLiteral(node.quasi);
      },
    };
  },
};

export default useSemanticToken;

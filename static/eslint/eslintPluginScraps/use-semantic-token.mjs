/**
 * ESLint rule: use-semantic-token
 *
 * Enforces that theme.tokens.* tokens are only used with appropriate
 * CSS properties based on their semantic category.
 */

/**
 * @typedef {Object} TokenRule
 * @property {string} name - Human-readable name for error messages
 * @property {string[]} tokenPatterns - Glob-like patterns to match token paths (e.g., 'content.*')
 * @property {Set<string>} allowedProperties - CSS properties these tokens can be used with
 */

/**
 * Token-to-property mapping configuration.
 * This is the SINGLE SOURCE OF TRUTH for:
 * 1. Token detection (which patterns to match)
 * 2. Property validation (which properties each category allows)
 * 3. Autofix suggestions (reverse lookup: property → correct category)
 *
 * Pattern syntax:
 * - 'content.*' matches tokens.content.X at any depth
 * - 'interactive.*.content' matches leaf 'content' under interactive (e.g., interactive.chonky.embossed.accent.content)
 * - 'interactive.*.content.*' matches nested content objects (e.g., interactive.chonky.debossed.neutral.content.primary)
 * - 'interactive.link.*' matches all link tokens (e.g., interactive.link.neutral.rest)
 *
 * @type {TokenRule[]}
 */
const TOKEN_RULES = [
  {
    name: 'content',
    tokenPatterns: [
      'content.*',
      'interactive.*.content',
      'interactive.*.content.*',
      'interactive.link.*',
    ],
    allowedProperties: new Set([
      'color',
      'text-decoration-color',
      'caret-color',
      'column-rule-color',
      '-webkit-text-fill-color',
      '-webkit-text-stroke-color',
    ]),
  },
];

/**
 * Check if a token path matches a glob pattern.
 *
 * Pattern syntax:
 * - 'foo.*' matches 'foo.bar', 'foo.bar.baz', etc. (any depth after foo)
 * - 'foo.*.bar' matches 'foo.X.bar', 'foo.X.Y.bar', etc. (bar at any depth under foo)
 * - 'foo.*.bar.*' matches 'foo.X.bar.Z', 'foo.X.Y.bar.Z.W', etc.
 *
 * @param {string} tokenPath - e.g., 'content.primary' or 'interactive.chonky.neutral.content'
 * @param {string} pattern - e.g., 'content.*' or 'interactive.*.content'
 * @returns {boolean}
 */
function matchesTokenPattern(tokenPath, pattern) {
  // Split pattern by '.*' to get fixed segments, filtering out empty strings
  const segments = pattern.split('.*').filter(s => s !== '');

  // If pattern ends with '.*', we need to match at least one more segment after
  const endsWithWildcard = pattern.endsWith('.*');

  // Build a regex from the pattern
  // Each segment must appear in order, with .* meaning "one or more path segments"
  let regexStr = '^';
  segments.forEach((segment, index) => {
    // Escape dots for regex
    regexStr += segment.replace(/\./g, '\\.');

    // Add wildcard matching between segments
    if (index < segments.length - 1) {
      // Between segments: match one or more path segments
      regexStr += '(\\.[^.]+)+';
    }
  });

  // If pattern ends with wildcard, add trailing wildcard match
  if (endsWithWildcard) {
    regexStr += '(\\.[^.]+)+';
  }

  regexStr += '$';

  return new RegExp(regexStr).test(tokenPath);
}

/**
 * Find the rule that applies to a given token path.
 * @param {string} tokenPath
 * @returns {TokenRule | null}
 */
function findRuleForToken(tokenPath) {
  for (const rule of TOKEN_RULES) {
    for (const pattern of rule.tokenPatterns) {
      if (matchesTokenPattern(tokenPath, pattern)) {
        return rule;
      }
    }
  }
  return null;
}

/**
 * Build reverse mapping: property → rule name.
 * Used for autofix suggestions.
 * @param {TokenRule[]} rules
 * @returns {Map<string, string>}
 */
function buildPropertyToRule(rules) {
  /** @type {Map<string, string>} */
  const result = new Map();
  for (const rule of rules) {
    for (const property of rule.allowedProperties) {
      result.set(property, rule.name);
    }
  }
  return result;
}

/**
 * Derived reverse mapping: property → rule name
 * @type {Map<string, string>}
 */
const PROPERTY_TO_RULE = buildPropertyToRule(TOKEN_RULES);

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
        'Enforce that theme.tokens.* tokens are only used with appropriate CSS properties',
      category: 'Best Practices',
    },
    schema: [],
    messages: {
      invalidProperty: '`{{property}}` cannot use token `{{tokenPath}}`',
      invalidPropertyWithSuggestion:
        '`{{property}}` cannot use token `{{tokenPath}}`. Use a `{{suggestedCategory}}` token instead.',
    },
  },

  create(context) {
    /**
     * Validate that a token is used with an allowed property for its category.
     * @param {import('estree').Node} node
     * @param {string} property
     * @param {import('estree').Node} [valueNode]
     */
    function validateToken(node, property, valueNode) {
      // Try to find the specific token node for precise highlighting
      const tokenInfo = findTokenNode(valueNode || node);
      if (!tokenInfo) {
        return; // Not a token reference matching any rule
      }

      const normalizedProperty = normalizeProperty(property);
      const rule = findRuleForToken(tokenInfo.tokenPath);

      if (rule && !rule.allowedProperties.has(normalizedProperty)) {
        const suggestedCategory = PROPERTY_TO_RULE.get(normalizedProperty);

        if (suggestedCategory) {
          context.report({
            node: tokenInfo.node,
            messageId: 'invalidPropertyWithSuggestion',
            data: {
              tokenPath: tokenInfo.tokenPath,
              property: normalizedProperty,
              suggestedCategory,
            },
          });
        } else {
          context.report({
            node: tokenInfo.node,
            messageId: 'invalidProperty',
            data: {
              tokenPath: tokenInfo.tokenPath,
              property: normalizedProperty,
            },
          });
        }
      }
    }

    /**
     * Find a token usage node and extract the full token path.
     * e.g., theme.tokens.content.primary → tokenPath: 'content.primary'
     * e.g., theme.tokens.interactive.chonky.neutral → tokenPath: 'interactive.chonky.neutral'
     *
     * @param {any} node
     * @returns {{node: any, tokenPath: string, tokenName: string} | null}
     */
    function findTokenNode(node) {
      if (!node || typeof node !== 'object') {
        return null;
      }

      // Check if this node is a MemberExpression chain that includes 'tokens'
      if (node.type === 'MemberExpression') {
        /** @type {string[]} */
        const pathParts = [];
        let current = node;

        // Walk up the member expression chain, collecting property names
        while (
          current.type === 'MemberExpression' &&
          current.property?.type === 'Identifier'
        ) {
          pathParts.unshift(current.property.name);
          current = current.object;
        }

        // Also check if current is an identifier (the base of the chain)
        if (current.type === 'Identifier') {
          pathParts.unshift(current.name);
        }

        // Check if we found 'tokens' in the chain
        const tokensIndex = pathParts.indexOf('tokens');
        if (tokensIndex !== -1 && tokensIndex < pathParts.length - 1) {
          const tokenPath = pathParts.slice(tokensIndex + 1).join('.');
          const tokenName = pathParts[pathParts.length - 1];

          // Only return if this token path matches any rule
          if (findRuleForToken(tokenPath)) {
            return {node, tokenPath, tokenName};
          }
        }
      }

      // Recursively search in child nodes
      for (const key of Object.keys(node)) {
        if (key === 'parent') {
          continue;
        }
        const child = node[key];
        if (Array.isArray(child)) {
          for (const item of child) {
            const result = findTokenNode(item);
            if (result) {
              return result;
            }
          }
        } else if (child && typeof child === 'object' && child.type) {
          const result = findTokenNode(child);
          if (result) {
            return result;
          }
        }
      }

      return null;
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

          validateToken(expr, property, expr);
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
        validateToken(node, propertyName, node.value);
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

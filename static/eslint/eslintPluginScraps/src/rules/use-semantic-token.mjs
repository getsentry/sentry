/**
 * ESLint rule: use-semantic-token
 *
 * Enforces that theme.tokens.* tokens are only used with appropriate
 * CSS properties based on their semantic category.
 */

import {normalizePropertyName} from '../ast/normalize/normalizePropertyName.mjs';
import {findRuleForToken, PROPERTY_TO_RULE} from '../config/tokenRules.mjs';

/**
 * @type {import('eslint').Rule.RuleModule}
 */
export const useSemanticToken = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce that theme.tokens.* tokens are only used with appropriate CSS properties',
      category: 'Best Practices',
    },
    schema: [
      {
        type: 'object',
        properties: {
          enabledCategories: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      invalidProperty: '`{{property}}` cannot use token `{{tokenPath}}`',
      invalidPropertyWithSuggestion:
        '`{{property}}` cannot use token `{{tokenPath}}`. Use a `{{suggestedCategory}}` token instead.',
    },
  },

  create(context) {
    const options = context.options[0] ?? {};
    /** @type {Set<string> | null} */
    const enabledCategories = options.enabledCategories
      ? new Set(options.enabledCategories)
      : null; // null means all enabled

    /**
     * Check if a category is enabled in the rule options.
     * @param {string} categoryName
     * @returns {boolean}
     */
    function isCategoryEnabled(categoryName) {
      return enabledCategories === null || enabledCategories.has(categoryName);
    }

    /**
     * Validate that a token is used with an allowed property for its category.
     * @param {import('estree').Node} node
     * @param {string} property
     * @param {import('estree').Node} [valueNode]
     */
    function validateToken(node, property, valueNode) {
      // Find all token nodes for precise highlighting
      const tokenInfos = findAllTokenNodes(valueNode || node);

      const normalizedProperty = normalizePropertyName(property);

      for (const tokenInfo of tokenInfos) {
        const rule = findRuleForToken(tokenInfo.tokenPath);

        // Skip if this category is not enabled
        if (rule && !isCategoryEnabled(rule.name)) {
          continue;
        }

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
    }

    /**
     * Find all token usage nodes and extract their full token paths.
     * e.g., theme.tokens.content.primary → tokenPath: 'content.primary'
     * e.g., theme.tokens.interactive.chonky.neutral → tokenPath: 'interactive.chonky.neutral'
     *
     * @param {any} node
     * @param {Array<{node: any, tokenPath: string, tokenName: string}>} [results]
     * @returns {Array<{node: any, tokenPath: string, tokenName: string}>}
     */
    function findAllTokenNodes(node, results = []) {
      if (!node || typeof node !== 'object') {
        return results;
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

          // Only add if this token path matches any rule
          if (findRuleForToken(tokenPath) && tokenName) {
            results.push({node, tokenPath, tokenName});
            // Skip recursing into this node's children since we've already
            // captured the full token path - recursing would find partial paths
            return results;
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
            findAllTokenNodes(item, results);
          }
        } else if (child && typeof child === 'object' && child.type) {
          findAllTokenNodes(child, results);
        }
      }

      return results;
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

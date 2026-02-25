/**
 * ESLint rule: prefer-tokens
 *
 * Detects hardcoded CSS values (spacing, border-radius, border-width) that
 * match known design tokens and suggests replacing them with theme token
 * references.
 */

import {shouldAnalyze} from '../ast/extractor/index.mjs';
import {createThemeTracker} from '../ast/extractor/theme.mjs';
import {findSizeTokenForValue, formatTokenAccess} from '../config/tokenRules.mjs';

/**
 * Check if a tagged template is a styled/css pattern.
 *
 * @param {import('estree').TaggedTemplateExpression} node
 * @returns {boolean}
 */
function isStyledOrCssTag(node) {
  const tag = node.tag;
  return (
    (tag.type === 'Identifier' && tag.name === 'css') ||
    (tag.type === 'MemberExpression' &&
      ((tag.property.type === 'Identifier' && tag.property.name === 'css') ||
        (tag.object.type === 'Identifier' && tag.object.name === 'styled'))) ||
    (tag.type === 'CallExpression' &&
      tag.callee.type === 'Identifier' &&
      tag.callee.name === 'styled')
  );
}

/**
 * Check if a value should be skipped (inside calc(), var(), etc.).
 *
 * @param {string} fullValue - The full CSS value string
 * @returns {boolean}
 */
function shouldSkipValue(fullValue) {
  return /\b(calc|var|env|min|max|clamp)\s*\(/.test(fullValue);
}

/**
 * Check if a string is a pixel value that could be a token.
 *
 * @param {string} value
 * @returns {boolean}
 */
function isPixelValue(value) {
  return /^\d+(\.\d+)?px$/.test(value);
}

/**
 * Format a full theme access string for a token.
 *
 * @param {string} themeExpression - e.g., 'p.theme', 'theme'
 * @param {string} prefix - e.g., 'space'
 * @param {string} tokenName - e.g., 'md', '2xl'
 * @returns {string} e.g., 'p.theme.space.md' or "theme.space['2xl']"
 */
function formatThemeAccess(themeExpression, prefix, tokenName) {
  return `${themeExpression}.${formatTokenAccess(prefix, tokenName)}`;
}

/**
 * Get the theme expression string from a theme binding.
 *
 * @param {import('../ast/extractor/types.mjs').ThemeBinding | null} binding
 * @returns {{ themeExpr: string, needsArrow: boolean }}
 */
function getThemeExpression(binding) {
  if (!binding) {
    return {themeExpr: 'p.theme', needsArrow: true};
  }
  if (binding.source === 'useTheme') {
    return {themeExpr: binding.localName, needsArrow: false};
  }
  // styled-callback or css-callback: binding.localName is the parameter name
  return {themeExpr: `${binding.localName}.theme`, needsArrow: false};
}

/**
 * @type {import('eslint').Rule.RuleModule}
 */
export const preferTokens = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer design tokens over hardcoded CSS values',
      category: 'Best Practices',
    },
    hasSuggestions: true,
    schema: [
      {
        type: 'object',
        properties: {
          enabledCategories: {
            type: 'array',
            items: {type: 'string'},
            description:
              'Limit to specific categories: "space", "radius", "border-width"',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      preferToken:
        'Hardcoded value `{{rawValue}}` can be replaced with `{{tokenAccess}}`.',
      replaceWithToken: 'Replace `{{rawValue}}` with `{{tokenAccess}}`.',
    },
  },

  create(context) {
    if (!shouldAnalyze(context)) {
      return {};
    }

    const options = context.options[0] ?? {};
    /** @type {Set<string> | null} */
    const enabledCategories = options.enabledCategories
      ? new Set(options.enabledCategories)
      : null;

    const themeTracker = createThemeTracker(context);

    /**
     * Check if a value matches a token for the given property, respecting
     * enabled categories.
     *
     * @param {string} value
     * @param {string} property
     * @returns {{ prefix: string, tokenName: string } | null}
     */
    function matchToken(value, property) {
      if (!isPixelValue(value)) {
        return null;
      }
      const match = findSizeTokenForValue(value, property);
      if (!match) {
        return null;
      }
      // Check enabledCategories filter — the category name is derived from
      // the rule name in SIZE_TOKEN_RULES, not the prefix
      if (enabledCategories) {
        // We need to check if the category that matched is enabled.
        // The prefix maps: space→space, radius→radius, border→border-width
        const categoryName = match.prefix === 'border' ? 'border-width' : match.prefix;
        if (!enabledCategories.has(categoryName)) {
          return null;
        }
      }
      return match;
    }

    /**
     * Process CSS text from a template quasi and report hardcoded values.
     *
     * @param {import('estree').TemplateElement} quasi
     */
    function checkQuasiCss(quasi) {
      const cssText = quasi.value.cooked || quasi.value.raw;
      if (!cssText) {
        return;
      }

      const sourceCode = context.sourceCode ?? context.getSourceCode();
      const quasiStart = quasi.range?.[0];
      if (!sourceCode || quasiStart === undefined) {
        return;
      }

      // Offset to skip the opening backtick/}
      const contentStart = quasiStart + 1;

      // Extract all CSS property: value pairs
      const declRegex = /([a-z-]+)\s*:\s*([^;{}]+)/gi;
      // eslint-disable-next-line no-restricted-syntax
      let declMatch;

      // eslint-disable-next-line no-cond-assign
      while ((declMatch = declRegex.exec(cssText)) !== null) {
        const property = declMatch[1] ?? '';
        const rawValueStr = declMatch[2]?.trim() ?? '';

        // Skip custom properties
        if (property.startsWith('--')) {
          continue;
        }

        // Skip values containing functions
        if (shouldSkipValue(rawValueStr)) {
          continue;
        }

        // Split shorthand values on whitespace
        const components = rawValueStr.split(/\s+/);

        for (const component of components) {
          const token = matchToken(component, property);
          if (!token) {
            continue;
          }

          const binding = themeTracker.getActiveBinding();
          const {themeExpr, needsArrow} = getThemeExpression(binding);
          const access = formatThemeAccess(themeExpr, token.prefix, token.tokenName);
          const displayAccess = formatTokenAccess(token.prefix, token.tokenName);

          // Calculate the position of this component in the source
          const componentOffsetInCss =
            declMatch.index +
            declMatch[0].indexOf(declMatch[2]) +
            declMatch[2].trimStart().length -
            declMatch[2].length +
            rawValueStr.indexOf(component);
          const absoluteStart = contentStart + componentOffsetInCss;
          const absoluteEnd = absoluteStart + component.length;

          // Validate range is within the quasi
          if (absoluteEnd > quasi.range[1]) {
            continue;
          }

          context.report({
            node: quasi,
            messageId: 'preferToken',
            data: {rawValue: component, tokenAccess: displayAccess},
            loc: {
              start: sourceCode.getLocFromIndex(absoluteStart),
              end: sourceCode.getLocFromIndex(absoluteEnd),
            },
            suggest: [
              {
                messageId: 'replaceWithToken',
                data: {rawValue: component, tokenAccess: displayAccess},
                fix(fixer) {
                  const interpolation = needsArrow
                    ? `\${p => ${access}}`
                    : `\${${access}}`;
                  return fixer.replaceTextRange(
                    [absoluteStart, absoluteEnd],
                    interpolation
                  );
                },
              },
            ],
          });
        }
      }
    }

    /**
     * Check if a node is inside a styled/css/style context by walking up
     * parent nodes.
     *
     * @param {import('estree').Node & {parent?: import('estree').Node}} node
     * @returns {boolean}
     */
    function isInStyleContext(node) {
      /** @type {import('estree').Node & {parent?: import('estree').Node} | undefined} */
      let current = node;
      while (current?.parent) {
        current =
          /** @type {import('estree').Node & {parent?: import('estree').Node}} */ (
            current.parent
          );

        // styled.div({...}) or styled(Comp)({...})
        if (current.type === 'CallExpression') {
          const callee = /** @type {any} */ (current.callee);
          // styled.div({...})
          if (
            callee.type === 'MemberExpression' &&
            callee.object?.type === 'Identifier' &&
            callee.object.name === 'styled'
          ) {
            return true;
          }
          // styled(Comp)({...})
          if (
            callee.type === 'CallExpression' &&
            callee.callee?.type === 'Identifier' &&
            callee.callee.name === 'styled'
          ) {
            return true;
          }
        }

        // css={{...}} or style={{...}} JSX attribute
        if (
          current.type === 'JSXExpressionContainer' &&
          current.parent?.type === 'JSXAttribute'
        ) {
          const attrName = /** @type {any} */ (current.parent).name?.name;
          if (attrName === 'css' || attrName === 'style') {
            return true;
          }
        }
      }
      return false;
    }

    return {
      ...themeTracker.visitors,

      TaggedTemplateExpression(node) {
        if (!isStyledOrCssTag(node)) {
          return;
        }
        for (const quasi of node.quasi.quasis) {
          checkQuasiCss(quasi);
        }
      },

      Property(node) {
        if (!node.key || !node.value) {
          return;
        }

        // Only check string literal values
        if (node.value.type !== 'Literal' || typeof node.value.value !== 'string') {
          return;
        }

        // Get property name
        const propertyName =
          node.key.type === 'Identifier'
            ? node.key.name
            : node.key.type === 'Literal'
              ? String(node.key.value)
              : null;
        if (!propertyName) {
          return;
        }

        // Skip custom properties
        if (propertyName.startsWith('--')) {
          return;
        }

        // Check if we're inside a style context
        if (!isInStyleContext(node)) {
          return;
        }

        const value = node.value.value;

        // Skip values containing functions
        if (shouldSkipValue(value)) {
          return;
        }

        // For object styles, handle shorthand by splitting on whitespace
        const components = value.split(/\s+/);
        for (const component of components) {
          const token = matchToken(component, propertyName);
          if (!token) {
            continue;
          }

          const binding = themeTracker.getActiveBinding();
          const {themeExpr} = getThemeExpression(binding);
          const access = formatThemeAccess(themeExpr, token.prefix, token.tokenName);
          const displayAccess = formatTokenAccess(token.prefix, token.tokenName);

          context.report({
            node: node.value,
            messageId: 'preferToken',
            data: {rawValue: component, tokenAccess: displayAccess},
            suggest: [
              {
                messageId: 'replaceWithToken',
                data: {rawValue: component, tokenAccess: displayAccess},
                fix(fixer) {
                  if (components.length === 1) {
                    // Single value — replace the entire literal with expression
                    return fixer.replaceText(node.value, access);
                  }
                  // Shorthand — replace the component in the string
                  const newValue = value.replace(component, `\${${access}}`);
                  return fixer.replaceText(node.value, `\`${newValue}\``);
                },
              },
            ],
          });
        }
      },
    };
  },
};

/**
 * Token rules configuration.
 *
 * This is the SINGLE SOURCE OF TRUTH for:
 * 1. Token detection (which keywords to match in token paths)
 * 2. Property validation (which properties each category allows)
 * 3. Autofix suggestions (reverse lookup: property → correct category)
 * 4. Size token replacement (hardcoded value → token path)
 */

import {normalizePropertyName} from '../ast/utils/normalizePropertyName.mjs';

/**
 * @typedef {Object} TokenRule
 * @property {string} name - Human-readable name for error messages
 * @property {string[]} keywords - Keywords to match in token paths (e.g., 'content', 'link')
 * @property {Set<string>} allowedProperties - CSS properties these tokens can be used with
 */

/**
 * @typedef {Object} SizeTokenRule
 * @property {string} name - Category identifier (e.g., 'space', 'radius', 'border-width')
 * @property {string} tokenPrefix - Theme object path segment (e.g., 'space' → theme.space.*)
 * @property {Map<string, string>} valueToToken - Map of CSS value → token key
 * @property {Set<string>} properties - CSS properties this category applies to
 */

/**
 * Token-to-property mapping configuration.
 *
 * Matching strategy: keyword detection with "most specific wins" precedence.
 * - Check if token path contains any known category keyword
 * - When multiple keywords match, the deepest/last one wins
 * - Example: 'interactive.border.content' → content rule (content is deeper)
 *
 * @type {TokenRule[]}
 */
const TOKEN_RULES = [
  {
    name: 'content',
    keywords: ['content', 'link'],
    allowedProperties: new Set([
      'color',
      'text-decoration',
      'text-decoration-color',
      'text-emphasis-color',
      'caret-color',
      'column-rule-color',
      '-webkit-text-fill-color',
      '-webkit-text-stroke-color',
      'fill',
      'stop-color',
    ]),
  },
  {
    name: 'background',
    keywords: ['background'],
    allowedProperties: new Set(['background', 'background-color', 'background-image']),
  },
  {
    name: 'border',
    keywords: ['border'],
    allowedProperties: new Set([
      'border',
      'border-color',
      'border-top',
      'border-right',
      'border-bottom',
      'border-left',
      'border-top-color',
      'border-right-color',
      'border-bottom-color',
      'border-left-color',
      'border-block',
      'border-block-color',
      'border-block-start',
      'border-block-start-color',
      'border-block-end',
      'border-block-end-color',
      'border-inline',
      'border-inline-color',
      'border-inline-start',
      'border-inline-start-color',
      'border-inline-end',
      'border-inline-end-color',
      'stroke',
      'text-decoration',
      'text-decoration-color',
      'border-image',
      'border-image-source',
    ]),
  },
  {
    name: 'focus',
    keywords: ['focus', 'elevation'],
    allowedProperties: new Set(['box-shadow', 'outline', 'outline-color', 'text-shadow']),
  },
  {
    name: 'graphics',
    keywords: ['graphics', 'dataviz'],
    allowedProperties: new Set([
      'background',
      'background-color',
      'background-image',
      'fill',
      'stroke',
      'stop-color',
    ]),
  },
  {
    name: 'syntax',
    keywords: ['syntax'],
    allowedProperties: new Set([
      'color',
      '-webkit-text-fill-color',
      '-webkit-text-stroke-color',
      'background',
      'background-color',
      'background-image',
    ]),
  },
];

/**
 * Find the rule that applies to a given token path.
 *
 * Uses keyword detection with "most specific wins" precedence:
 * - Checks if token path contains any known category keyword
 * - If multiple keywords match, the deepest/last one wins
 * - Example: 'interactive.background.content' → content rule
 *
 * @param {string} tokenPath - e.g., 'content.primary' or 'interactive.chonky.neutral.content'
 * @returns {TokenRule | null}
 */
export function findRuleForToken(tokenPath) {
  const pathParts = tokenPath.split('.');

  // Find the rule whose keyword appears deepest in the path
  let bestMatch = null;
  let bestPosition = -1;

  for (const rule of TOKEN_RULES) {
    for (const keyword of rule.keywords) {
      const position = pathParts.lastIndexOf(keyword);
      if (position > bestPosition) {
        bestMatch = rule;
        bestPosition = position;
      }
    }
  }

  return bestMatch;
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
export const PROPERTY_TO_RULE = buildPropertyToRule(TOKEN_RULES);

// ---------------------------------------------------------------------------
// Size token rules — maps hardcoded CSS values to design token replacements
// ---------------------------------------------------------------------------

/**
 * Size token categories with value→token mappings and applicable CSS properties.
 * Values are derived from static/app/utils/theme/scraps/tokens/size.tsx.
 *
 * @type {SizeTokenRule[]}
 */
const SIZE_TOKEN_RULES = [
  {
    name: 'space',
    tokenPrefix: 'space',
    valueToToken: new Map([
      ['0px', '0'],
      ['2px', '2xs'],
      ['4px', 'xs'],
      ['6px', 'sm'],
      ['8px', 'md'],
      ['12px', 'lg'],
      ['16px', 'xl'],
      ['24px', '2xl'],
      ['32px', '3xl'],
    ]),
    properties: new Set([
      'padding',
      'padding-top',
      'padding-right',
      'padding-bottom',
      'padding-left',
      'padding-block',
      'padding-block-start',
      'padding-block-end',
      'padding-inline',
      'padding-inline-start',
      'padding-inline-end',
      'margin',
      'margin-top',
      'margin-right',
      'margin-bottom',
      'margin-left',
      'margin-block',
      'margin-block-start',
      'margin-block-end',
      'margin-inline',
      'margin-inline-start',
      'margin-inline-end',
      'gap',
      'row-gap',
      'column-gap',
      'top',
      'right',
      'bottom',
      'left',
      'inset',
      'inset-block',
      'inset-block-start',
      'inset-block-end',
      'inset-inline',
      'inset-inline-start',
      'inset-inline-end',
    ]),
  },
  {
    name: 'radius',
    tokenPrefix: 'radius',
    valueToToken: new Map([
      ['0px', '0'],
      ['3px', '2xs'],
      ['4px', 'xs'],
      ['5px', 'sm'],
      ['6px', 'md'],
      ['8px', 'lg'],
      ['12px', 'xl'],
      ['16px', '2xl'],
      ['999px', 'full'],
    ]),
    properties: new Set([
      'border-radius',
      'border-top-left-radius',
      'border-top-right-radius',
      'border-bottom-left-radius',
      'border-bottom-right-radius',
      'border-start-start-radius',
      'border-start-end-radius',
      'border-end-start-radius',
      'border-end-end-radius',
    ]),
  },
  {
    name: 'border-width',
    tokenPrefix: 'border',
    valueToToken: new Map([
      ['0px', '0'],
      ['1px', 'md'],
      ['1.5px', 'lg'],
      ['2px', 'xl'],
      ['4px', '2xl'],
    ]),
    properties: new Set([
      'border-width',
      'border-top-width',
      'border-right-width',
      'border-bottom-width',
      'border-left-width',
      'border-block-width',
      'border-block-start-width',
      'border-block-end-width',
      'border-inline-width',
      'border-inline-start-width',
      'border-inline-end-width',
      'outline-width',
    ]),
  },
];

/**
 * Build a reverse lookup: property → SizeTokenRule for O(1) lookups.
 * @param {SizeTokenRule[]} rules
 * @returns {Map<string, SizeTokenRule>}
 */
function buildPropertyToSizeRule(rules) {
  /** @type {Map<string, SizeTokenRule>} */
  const result = new Map();
  for (const rule of rules) {
    for (const property of rule.properties) {
      result.set(property, rule);
    }
  }
  return result;
}

/** @type {Map<string, SizeTokenRule>} */
const PROPERTY_TO_SIZE_RULE = buildPropertyToSizeRule(SIZE_TOKEN_RULES);

/**
 * Given a CSS value and property, find the matching size token.
 *
 * Uses the property to disambiguate categories — e.g., `4px` with
 * `padding` resolves to `space.xs`, but `4px` with `border-radius`
 * resolves to `radius.xs`.
 *
 * @param {string} value - CSS value (e.g., '8px')
 * @param {string} property - CSS property name (camelCase or kebab-case)
 * @returns {{ prefix: string, tokenName: string } | null}
 */
export function findSizeTokenForValue(value, property) {
  const normalized = normalizePropertyName(property);
  const rule = PROPERTY_TO_SIZE_RULE.get(normalized);
  if (!rule) {
    return null;
  }
  const tokenName = rule.valueToToken.get(value);
  if (!tokenName) {
    return null;
  }
  return {prefix: rule.tokenPrefix, tokenName};
}

/**
 * Format a token access path as valid JS property access.
 * Uses bracket notation for keys that aren't valid identifiers.
 *
 * @param {string} prefix - Token prefix (e.g., 'space')
 * @param {string} tokenName - Token key (e.g., 'md', '2xl')
 * @returns {string} e.g., 'space.md' or "space['2xl']"
 */
export function formatTokenAccess(prefix, tokenName) {
  const isValidIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(tokenName);
  return isValidIdentifier ? `${prefix}.${tokenName}` : `${prefix}['${tokenName}']`;
}

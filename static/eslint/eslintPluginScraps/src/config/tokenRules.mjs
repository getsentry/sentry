/**
 * Token rules configuration.
 *
 * This is the SINGLE SOURCE OF TRUTH for:
 * 1. Token detection (which keywords to match in token paths)
 * 2. Property validation (which properties each category allows)
 * 3. Autofix suggestions (reverse lookup: property → correct category)
 */

/**
 * @typedef {Object} TokenRule
 * @property {string} name - Human-readable name for error messages
 * @property {string[]} keywords - Keywords to match in token paths (e.g., 'content', 'link')
 * @property {Set<string>} allowedProperties - CSS properties these tokens can be used with
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

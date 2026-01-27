/**
 * Token rules configuration.
 *
 * This is the SINGLE SOURCE OF TRUTH for:
 * 1. Token detection (which patterns to match)
 * 2. Property validation (which properties each category allows)
 * 3. Autofix suggestions (reverse lookup: property → correct category)
 */

/**
 * @typedef {Object} TokenRule
 * @property {string} name - Human-readable name for error messages
 * @property {string[]} tokenPatterns - Glob-like patterns to match token paths (e.g., 'content.*')
 * @property {Set<string>} allowedProperties - CSS properties these tokens can be used with
 */

/**
 * Token-to-property mapping configuration.
 *
 * Pattern syntax:
 * - 'content.*' matches tokens.content.X at any depth
 * - 'interactive.*.content' matches leaf 'content' under interactive (e.g., interactive.chonky.embossed.accent.content)
 * - 'interactive.*.content.*' matches nested content objects (e.g., interactive.chonky.debossed.neutral.content.primary)
 * - 'interactive.link.*' matches all link tokens (e.g., interactive.link.neutral.rest)
 *
 * @type {TokenRule[]}
 */
export const TOKEN_RULES = [
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
export function matchesTokenPattern(tokenPath, pattern) {
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
export function findRuleForToken(tokenPath) {
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
export const PROPERTY_TO_RULE = buildPropertyToRule(TOKEN_RULES);

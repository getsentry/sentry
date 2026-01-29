/**
 * Utility for normalizing CSS property names to kebab-case.
 */

/**
 * Convert camelCase to kebab-case
 * @param {string} str
 * @returns {string}
 */
function camelToKebabCase(str) {
  return str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}

/**
 * Normalize property name to kebab-case for consistent lookup.
 *
 * Examples:
 * - 'backgroundColor' → 'background-color'
 * - 'color' → 'color' (unchanged)
 * - '--custom-prop' → '--custom-prop' (unchanged)
 * - '-webkit-text-fill-color' → '-webkit-text-fill-color' (unchanged)
 *
 * @param {string} property
 * @returns {string}
 */
export function normalizePropertyName(property) {
  // CSS custom properties and vendor prefixes stay as-is (just lowercase)
  if (property.startsWith('-')) {
    return property.toLowerCase();
  }
  // Already kebab-case
  if (property.includes('-')) {
    return property.toLowerCase();
  }
  // Convert camelCase to kebab-case
  return camelToKebabCase(property);
}

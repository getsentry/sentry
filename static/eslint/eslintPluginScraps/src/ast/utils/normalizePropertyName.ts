/**
 * Utility for normalizing CSS property names to kebab-case.
 */

/**
 * Convert camelCase to kebab-case
 */
function camelToKebabCase(str: string) {
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
 */
export function normalizePropertyName(property: string) {
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

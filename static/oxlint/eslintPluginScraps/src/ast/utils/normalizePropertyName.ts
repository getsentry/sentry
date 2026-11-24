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
  return property.includes('-')
    ? property.toLowerCase()
    : property.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}

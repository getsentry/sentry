/**
 * Sanitizes a string so that it can be used as a query selector
 *
 * e.g. `feedback:branding` --> `feedback-branding` or
 * 'Data Scrubbing' --> 'Data-Scrubbing'
 *
 * @param str The string to sanitize
 * @return Returns a sanitized string (replace
 */
export function sanitizeQuerySelector(str: string) {
  return typeof str === 'string' ? str.replace(/[ :]+/g, '-') : '';
}

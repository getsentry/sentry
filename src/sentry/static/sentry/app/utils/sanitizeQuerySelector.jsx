/**
 * Sanitizes a string so that it can be used as a query selector
 *
 * e.g. `feedback:branding` --> `feedback-branding` or
 * 'Data Privacy' --> 'Data-Privacy'
 *
 * @param {String} str The string to sanitize
 * @return {String} Returns a sanitized string (replace
 */
export function sanitizeQuerySelector(str) {
  return typeof str === 'string' ? str.replace(/[ :]+/g, '-') : '';
}

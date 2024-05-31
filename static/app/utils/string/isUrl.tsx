/**
 * This function has a critical security impact, make sure to check all usages before changing this function.
 * In some parts of our code we rely on that this only really is a string starting with http(s).
 */

export function isUrl(str: any): boolean {
  return (
    typeof str === 'string' &&
    (str.indexOf('http://') === 0 || str.indexOf('https://') === 0)
  );
}

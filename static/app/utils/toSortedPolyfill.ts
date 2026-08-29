/**
 * Polyfill for Array.prototype.toSorted (ES2023).
 * Required for browsers that don't support it (e.g. Chrome < 110).
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSorted
 */
if (!Array.prototype.toSorted) {
  // eslint-disable-next-line no-extend-native
  Array.prototype.toSorted = function <T>(
    this: T[],
    compareFn?: (a: T, b: T) => number
  ): T[] {
    return [...this].sort(compareFn);
  };
}

/**
 * Calculate min/max of an array simultaneously.
 * This prevents two things:
 * - Avoid extra allocations and iterations, just loop through once.
 * - Avoid `Maximum call stack size exceeded` when the array is too large
 *   `Math.min()` & `Math.max()` will throw after about ~10⁷ which is A LOT of items.
 *   See: https://stackoverflow.com/a/52613386
 *
 * `lodash.min()` & `lodash.max()` are also options, they use a while-loop as here,
 * but that also includes a comparator function which adds overhead.
 */
export default function getMinMax(arr: number[]) {
  let len = arr.length;
  let min = Infinity;
  let max = -Infinity;

  while (len--) {
    min = arr[len] < min ? arr[len] : min;
    max = arr[len] > max ? arr[len] : max;
  }

  return {min, max};
}

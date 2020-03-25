/**
 * Generic type guard for children as a function patterns.
 */
export function isRenderFunc<T>(func: React.ReactNode | Function): func is T {
  return typeof func === 'function';
}

/**
 * Generic type guard for children a function patterns.
 */
export function isRenderFunc<T>(func: React.ReactNode | Function): func is T {
  return typeof func === 'function';
}

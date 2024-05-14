/**
 * Generic type guard for children as a function patterns.
 */
export function isRenderFunc<T extends React.ReactNode | Function>(
  func: React.ReactNode | Function
): func is T {
  return typeof func === 'function';
}

/**
 * Generic type guard for children as a function patterns.
 */
export function isRenderFunc<Props, Result>(
  func: React.ReactNode | ((props: Props) => Result)
): func is (props: Props) => Result {
  return typeof func === 'function';
}

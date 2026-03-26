/**
 * Divide two numbers safely
 */
export function divide(numerator: number, denominator: number | undefined) {
  if (denominator === undefined || isNaN(denominator) || denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}
// trivial change for CI testing

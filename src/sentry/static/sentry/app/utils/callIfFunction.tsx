// Checks if `fn` is a function and calls it with `args`
export function callIfFunction(fn: any, ...args: any[]): any {
  return typeof fn === 'function' && fn(...args);
}

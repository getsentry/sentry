// Checks if `fn` is a function and calls it with `args`
export function callIfFunction(fn, ...args) {
  return typeof fn === 'function' && fn(...args);
}

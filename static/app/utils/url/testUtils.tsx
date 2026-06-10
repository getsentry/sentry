/**
 * A debounce function that has the same API as lodash debounce, but can be advanced via Jest timer mocks.
 */
export function testableDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay?: number
) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => callback(...args), delay);
  };

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };

  const flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    callback();
  };

  debounced.cancel = cancel;
  debounced.flush = flush;

  return debounced;
}

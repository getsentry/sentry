/**
 * All stores implementing this interface have a common getState which returns
 * the stores state.
 *
 * When a store implements this it becomes usable with the `useLegacyStore` hook.
 */
export type CommonStoreInterface<T> = {
  /**
   * Returns the current state represented within the store
   */
  getState(): T;
};

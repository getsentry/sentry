import {useStore} from 'zustand';
import type {StoreApi} from 'zustand';

/**
 * Returns the state of a store and re-renders when it changes.
 *
 * ```tsx
 * const teams = useLegacyStore(TeamStore);
 * ```
 */
export function useLegacyStore<S extends StoreApi<any>>(
  store: S
): ReturnType<S['getState']> {
  return useStore(store) as ReturnType<S['getState']>;
}

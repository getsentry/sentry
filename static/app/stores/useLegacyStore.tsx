import {useSelector} from '@tanstack/react-store';

import type {createLegacyStore} from 'sentry/stores/createLegacyStore';

type LegacyStore = Pick<ReturnType<typeof createLegacyStore<any>>, 'source' | 'getState'>;

/**
 * Returns the state of a store and re-renders when it changes.
 *
 * ```tsx
 * const teams = useLegacyStore(TeamStore);
 * ```
 */
export function useLegacyStore<S extends LegacyStore>(
  store: S
): ReturnType<S['getState']> {
  return useSelector(store.source);
}

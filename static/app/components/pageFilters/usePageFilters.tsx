import {useLegacyStore} from 'sentry/stores/useLegacyStore';

import {PageFiltersStore} from './store';

/**
 * Custom hook that returns the state of page filters
 */
export function usePageFilters() {
  return useLegacyStore(PageFiltersStore);
}

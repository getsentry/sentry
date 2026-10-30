import {useStore} from 'zustand';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';

/**
 * Custom hook that returns the state of page filters
 */
export function usePageFilters() {
  return useStore(PageFiltersStore);
}

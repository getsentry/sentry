import {useStore} from 'zustand';

import {PageFiltersStore} from './store';

/**
 * Custom hook that returns the state of page filters
 */
export function usePageFilters() {
  return useStore(PageFiltersStore);
}

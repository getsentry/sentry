import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

/**
 * Custom hook that returns the state of page filters
 */
function usePageFilters() {
  return useLegacyStore(PageFiltersStore);
}

export default usePageFilters;

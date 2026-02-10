import PageFiltersStore from 'sentry/components/pageFilters/store';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

/**
 * Custom hook that returns the state of page filters
 */
function usePageFilters() {
  return useLegacyStore(PageFiltersStore);
}

export default usePageFilters;

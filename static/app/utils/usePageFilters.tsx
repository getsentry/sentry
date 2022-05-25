import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

/**
 * Custom hook that returns the state of page filters
 */
function usePageFilters() {
  const pageFiltersState = useLegacyStore(PageFiltersStore);

  return {
    ...pageFiltersState,

    /**
     * Maintain compatibility with `withPageFilters` HoC
     */
    isGlobalSelectionReady: pageFiltersState.isReady,
  } as const;
}

export default usePageFilters;

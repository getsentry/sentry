import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {PageFilters} from 'sentry/types';

type UsePageFilters = {
  /**
   * PageFilters are ready
   */
  isGlobalSelectionReady: boolean;
  /**
   * The page filters that are currently selected
   */
  selection: PageFilters;
};

/**
 * Custom hook that returns the state of page filters
 */
function usePageFilters(): UsePageFilters {
  const {selection, isReady: isGlobalSelectionReady} = useLegacyStore(PageFiltersStore);

  return {
    selection,
    isGlobalSelectionReady,
  };
}

export default usePageFilters;

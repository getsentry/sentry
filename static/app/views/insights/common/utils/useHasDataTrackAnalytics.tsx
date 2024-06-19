import {useEffect} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useHasData} from 'sentry/views/insights/common/queries/useHasData';

export function useHasDataTrackAnalytics(
  mutableSearch: MutableSearch,
  referrer: string,
  analyticEvent: string
) {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const {hasData, isLoading: isHasDataLoading} = useHasData(mutableSearch, referrer);

  useEffect(() => {
    if (!isHasDataLoading) {
      trackAnalytics(analyticEvent, {
        organization,
        has_data: hasData,
      });
    }
  }, [
    organization,
    hasData,
    isHasDataLoading,
    analyticEvent,
    // Treat different project selections as unique analytic events
    pageFilters.selection.projects,
  ]);
}

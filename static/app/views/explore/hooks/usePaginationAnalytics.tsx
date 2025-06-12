import {useCallback} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

export function usePaginationAnalytics(
  type: 'samples' | 'traces' | 'aggregates',
  numResults: number
) {
  const organization = useOrganization();

  return useCallback(
    (direction: string) => {
      trackAnalytics('trace.explorer.table_pagination', {
        direction,
        type,
        num_results: numResults,
        organization,
      });
    },
    [organization, numResults, type]
  );
}

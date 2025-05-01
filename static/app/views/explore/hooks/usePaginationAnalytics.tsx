import {useCallback} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

export function usePaginationAnalytics(numResults: number) {
  const organization = useOrganization();

  return useCallback(
    (direction: string) => {
      trackAnalytics('trace.explorer.table_pagination', {
        direction,
        type: 'traces',
        num_results: numResults,
        organization,
      });
    },
    [organization, numResults]
  );
}

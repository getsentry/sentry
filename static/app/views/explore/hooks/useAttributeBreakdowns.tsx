import {useMemo, useRef} from 'react';

import {pageFiltersToQueryParams} from 'sentry/components/organizations/pageFilters/parse';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import usePrevious from 'sentry/utils/usePrevious';
import {CHARTS_PER_PAGE} from 'sentry/views/explore/components/attributeBreakdowns/constants';

type AttributeDistributionData = Record<string, Array<{label: string; value: number}>>;

type AttributeBreakdowns = {
  data: Array<{
    attribute_distributions: {
      data: AttributeDistributionData;
    };
  }>;
};

// The /trace-items/stats/ endpoint returns a paginated response, but recommends fetching
//  more data than we need to display the current page. Hence we accumulate the
// data across paginated requests.
function useAttributeBreakdowns({
  cursor,
  substringMatch,
}: {
  cursor: string | undefined;
  substringMatch: string;
}) {
  const organization = useOrganization();
  const location = useLocation();
  const {selection: pageFilters, isReady: pageFiltersReady} = usePageFilters();
  const queryString = location.query.query?.toString() ?? '';

  // Ref to accumulate data across paginated requests
  const accumulatedDataRef = useRef<AttributeDistributionData>({});

  // Clear accumulated data when anything other than cursor changes
  const previousSubstringMatch = usePrevious(substringMatch);
  const previousQueryString = usePrevious(queryString);
  const previousPageFilters = usePrevious(pageFilters);
  if (
    previousSubstringMatch !== substringMatch ||
    previousQueryString !== queryString ||
    previousPageFilters !== pageFilters
  ) {
    accumulatedDataRef.current = {};
  }

  const queryParams = useMemo(() => {
    const params = {
      ...pageFiltersToQueryParams(pageFilters),
      query: queryString,
      statsType: 'attributeDistributions',
      limit: CHARTS_PER_PAGE * 2,
    } as Record<string, any>;

    if (cursor !== undefined) {
      params.cursor = cursor;
    }

    if (substringMatch) {
      params.substringMatch = substringMatch;
    }

    return params;
  }, [pageFilters, queryString, cursor, substringMatch]);

  const result = useApiQuery<AttributeBreakdowns>(
    [`/organizations/${organization.slug}/trace-items/stats/`, {query: queryParams}],
    {
      staleTime: Infinity,
      enabled: pageFiltersReady,
    }
  );

  const data = useMemo((): AttributeDistributionData | undefined => {
    const newData = result.data?.data[0]?.attribute_distributions?.data;
    if (newData) {
      accumulatedDataRef.current = {
        ...accumulatedDataRef.current,
        ...newData,
      };
    }
    return Object.keys(accumulatedDataRef.current).length > 0
      ? accumulatedDataRef.current
      : newData;
  }, [result.data]);

  return {
    ...result,
    data,
  };
}

export default useAttributeBreakdowns;

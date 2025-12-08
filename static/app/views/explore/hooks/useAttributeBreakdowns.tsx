import {useMemo} from 'react';

import {pageFiltersToQueryParams} from 'sentry/components/organizations/pageFilters/parse';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

type AttributeBreakdowns = {
  data: Array<{
    attribute_distributions: {
      data: Record<string, Array<{label: string; value: number}>>;
    };
  }>;
};

function useAttributeBreakdowns() {
  const organization = useOrganization();
  const location = useLocation();
  const {selection: pageFilters, isReady: pageFiltersReady} = usePageFilters();
  const queryString = location.query.query?.toString() ?? '';

  const queryParams = useMemo(() => {
    return {
      ...pageFiltersToQueryParams(pageFilters),
      query: queryString,
      statsType: 'attributeDistributions',
    };
  }, [pageFilters, queryString]);

  return useApiQuery<AttributeBreakdowns>(
    [`/organizations/${organization.slug}/trace-items/stats/`, {query: queryParams}],
    {
      staleTime: Infinity,
      enabled: pageFiltersReady,
    }
  );
}

export default useAttributeBreakdowns;

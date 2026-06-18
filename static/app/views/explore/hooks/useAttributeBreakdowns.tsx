import {useEffect, useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useQueryState} from 'nuqs';

import {pageFiltersToQueryParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {usePrevious} from 'sentry/utils/usePrevious';
import {CHARTS_PER_PAGE} from 'sentry/views/explore/components/attributeBreakdowns/constants';

type AttributeDistributionData = Record<string, Array<{label: string; value: number}>>;

type AttributeBreakdowns = {
  data: Array<{
    attribute_distributions: {
      data: AttributeDistributionData;
    };
  }>;
};

// The /trace-items/stats/ endpoint returns a cursor-paginated response. We page
// through it one page (CHARTS_PER_PAGE) at a time using the cursor from the Link header.
export function useAttributeBreakdowns({substringMatch}: {substringMatch: string}) {
  const organization = useOrganization();
  const location = useLocation();
  const {selection: pageFilters, isReady: pageFiltersReady} = usePageFilters();
  const [cursor, setCursor] = useQueryState('attributeBreakdownsCursor');
  const queryString = location.query.query?.toString() ?? '';

  const resultSetKey = useMemo(
    () =>
      JSON.stringify({
        query: queryString,
        substringMatch,
        projects: pageFilters.projects,
        environments: pageFilters.environments,
        datetime: pageFilters.datetime,
      }),
    [
      pageFilters.datetime,
      pageFilters.environments,
      pageFilters.projects,
      queryString,
      substringMatch,
    ]
  );
  const previousResultSetKey = usePrevious(resultSetKey);
  const didResultSetChange = previousResultSetKey !== resultSetKey;

  useEffect(() => {
    if (didResultSetChange && cursor !== null) {
      setCursor(null);
    }
  }, [cursor, didResultSetChange, setCursor]);

  const queryParams = useMemo(() => {
    const params = {
      ...pageFiltersToQueryParams(pageFilters),
      query: queryString,
      statsType: 'attributeDistributions',
      limit: CHARTS_PER_PAGE,
    } as Record<string, any>;

    const validCursor = didResultSetChange ? undefined : (cursor ?? undefined);
    if (validCursor !== undefined) {
      params.cursor = validCursor;
    }

    if (substringMatch) {
      params.substringMatch = substringMatch;
    }

    return params;
  }, [pageFilters, queryString, didResultSetChange, cursor, substringMatch]);

  const {
    data: response,
    isLoading,
    error,
  } = useQuery({
    ...apiOptions.as<AttributeBreakdowns>()(
      '/organizations/$organizationIdOrSlug/trace-items/stats/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: queryParams,
        staleTime: Infinity,
      }
    ),
    select: selectJsonWithHeaders,
    enabled: pageFiltersReady,
  });

  const data = useMemo((): AttributeDistributionData | undefined => {
    return response?.json?.data[0]?.attribute_distributions?.data;
  }, [response?.json]);

  return {
    data,
    isLoading,
    error,
    pageLinks: response?.headers.Link ?? null,
    setCursor,
  };
}

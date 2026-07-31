import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {pageFiltersToQueryParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {CHARTS_PER_PAGE} from 'sentry/views/explore/components/attributeBreakdowns/constants';

type AttributeDistributionData = Record<string, Array<{label: string; value: number}>>;

type AttributeBreakdowns = {
  data: Array<{
    // Read both keys during the backend rename rollout (attribute_distributions -> attributeDistributions).
    attributeDistributions?: {
      data: AttributeDistributionData;
    };
    attribute_distributions?: {
      data: AttributeDistributionData;
    };
  }>;
};

// The /trace-items/stats/ endpoint returns a paginated response.
export function useAttributeBreakdowns({
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

  const queryParams = useMemo(() => {
    const params = {
      ...pageFiltersToQueryParams(pageFilters),
      query: queryString,
      statsType: 'attributeDistributions',
      limit: CHARTS_PER_PAGE,
    } as Record<string, any>;

    if (cursor !== undefined) {
      params.cursor = cursor;
    }

    if (substringMatch) {
      params.substringMatch = substringMatch;
    }

    return params;
  }, [pageFilters, queryString, cursor, substringMatch]);

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

  return {
    data:
      response?.json?.data[0]?.attributeDistributions?.data ??
      response?.json?.data[0]?.attribute_distributions?.data,
    isLoading,
    error,
    pageLinks: response?.headers.Link ?? null,
  };
}

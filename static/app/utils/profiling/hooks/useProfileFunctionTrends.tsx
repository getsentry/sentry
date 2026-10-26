import {useQuery} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {FunctionTrend, TrendType} from './types';

interface UseProfileFunctionTrendsOptions {
  trendFunction: 'p50()' | 'p75()' | 'p95()' | 'p99()';
  trendType: TrendType;
  cursor?: string;
  limit?: number;
  query?: string;
}

export function useProfileFunctionTrends({
  cursor,
  limit,
  query,
  trendFunction,
  trendType,
}: UseProfileFunctionTrendsOptions) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  return useQuery({
    ...apiOptions.as<FunctionTrend[]>()(
      '/organizations/$organizationIdOrSlug/profiling/function-trends/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          project: selection.projects,
          environment: selection.environments,
          ...normalizeDateTimeParams(selection.datetime),
          function: trendFunction,
          trend: trendType,
          query,
          per_page: limit,
          cursor,
        },
        staleTime: 0,
      }
    ),
    select: selectJsonWithHeaders,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

import {useQuery} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {PageFilters} from 'sentry/types/core';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {FunctionTrend, TrendType} from './types';

interface UseProfileFunctionTrendsOptions {
  trendFunction: 'p50()' | 'p75()' | 'p95()' | 'p99()';
  trendType: TrendType;
  cursor?: string;
  datetime?: PageFilters['datetime'];
  enabled?: boolean;
  limit?: number;
  projects?: Array<number | string>;
  query?: string;
  refetchOnMount?: boolean;
}

export function useProfileFunctionTrends({
  cursor,
  datetime,
  projects,
  enabled,
  limit,
  query,
  refetchOnMount,
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
          project: projects || selection.projects,
          environment: selection.environments,
          ...normalizeDateTimeParams(datetime ?? selection.datetime),
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
    refetchOnMount,
    retry: false,
    enabled,
  });
}

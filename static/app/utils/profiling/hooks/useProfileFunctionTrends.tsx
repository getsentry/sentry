import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import type {FunctionTrend, TrendType} from './types';

interface UseProfileFunctionTrendsOptions<F extends string> {
  trendFunction: F;
  trendType: TrendType;
  cursor?: string;
  datetime?: PageFilters['datetime'];
  enabled?: boolean;
  limit?: number;
  projects?: Array<number | string>;
  query?: string;
  refetchOnMount?: boolean;
}

export function useProfileFunctionTrends<F extends string>({
  cursor,
  datetime,
  projects,
  enabled,
  limit,
  query,
  refetchOnMount,
  trendFunction,
  trendType,
}: UseProfileFunctionTrendsOptions<F>) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const path = `/organizations/${organization.slug}/profiling/function-trends/`;
  const endpointOptions = {
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
  };

  return useApiQuery<FunctionTrend[]>([path, endpointOptions], {
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount,
    retry: false,
    enabled,
  });
}

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {PageFilters} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import type {FunctionTrend, TrendType} from './types';

interface UseProfileFunctionTrendsOptions<F extends string> {
  trendFunction: F;
  trendType: TrendType;
  datetime?: PageFilters['datetime'];
  enabled?: boolean;
  projects?: (number | string)[];
  query?: string;
  refetchOnMount?: boolean;
}

export function useProfileFunctionTrends<F extends string>({
  datetime,
  projects,
  enabled,
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

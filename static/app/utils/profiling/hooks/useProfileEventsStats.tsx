import {useMemo} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import {transformStatsResponse} from 'sentry/utils/profiling/hooks/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

interface UseProfileEventsStatsOptions<F> {
  dataset: 'discover' | 'profiles' | 'profileFunctions';
  referrer: string;
  yAxes: readonly F[];
  datetime?: PageFilters['datetime'];
  enabled?: boolean;
  interval?: string;
  query?: string;
}

export function useProfileEventsStats<F extends string>({
  dataset,
  datetime,
  interval,
  query,
  referrer,
  yAxes,
  enabled = true,
}: UseProfileEventsStatsOptions<F>) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  // when using the profiles dataset and the feature flag is enabled,
  // switch over to the discover dataset under the hood
  if (dataset === 'profiles') {
    dataset = 'discover';
  }

  if (dataset === 'discover') {
    query = `(has:profile.id OR (has:profiler.id has:thread.id)) ${query ? `(${query})` : ''}`;
  }

  const path = `/organizations/${organization.slug}/events-stats/`;
  const endpointOptions = {
    query: {
      dataset,
      referrer,
      project: selection.projects,
      environment: selection.environments,
      ...normalizeDateTimeParams(datetime ?? selection.datetime),
      yAxis: yAxes,
      interval,
      query,
      partial: 1,
    },
  };

  const {data, ...rest} = useApiQuery<any>([path, endpointOptions], {
    enabled,
    staleTime: Infinity,
  });

  const transformed = useMemo(
    () => data && transformStatsResponse(dataset, yAxes, data),
    [yAxes, data, dataset]
  );

  return {
    data: transformed,
    ...rest,
  };
}

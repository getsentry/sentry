import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {PageFilterDatetime} from 'sentry/types/core';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {transformStatsResponse} from 'sentry/utils/profiling/hooks/utils';
import {useOrganization} from 'sentry/utils/useOrganization';

interface UseProfileEventsStatsOptions<F> {
  dataset: 'discover' | 'profiles' | 'profileFunctions';
  referrer: string;
  yAxes: readonly F[];
  datetime?: PageFilterDatetime;
  query?: string;
}

export function useProfileEventsStats<F extends string>({
  dataset,
  datetime,
  query,
  referrer,
  yAxes,
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

  const {data, isPending, isError, error} = useQuery({
    ...apiOptions.as<any>()('/organizations/$organizationIdOrSlug/events-stats/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        dataset,
        referrer,
        project: selection.projects,
        environment: selection.environments,
        ...normalizeDateTimeParams(datetime ?? selection.datetime),
        yAxis: yAxes,
        query,
        partial: 1,
      },
      staleTime: Infinity,
    }),
  });

  const transformed = useMemo(
    () => data && transformStatsResponse(dataset, yAxes, data),
    [yAxes, data, dataset]
  );

  return {
    data: transformed,
    isPending,
    isError,
    error,
  };
}

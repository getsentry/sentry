import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import type {EventsResults, Sort} from './types';

interface UseProfileEventsOptions<F extends string = ProfilingFieldType> {
  fields: readonly F[];
  referrer: string;
  sort: Sort<F>;
  cursor?: string;
  datetime?: PageFilters['datetime'];
  enabled?: boolean;
  limit?: number;
  projects?: Array<number | string>;
  query?: string;
  refetchOnMount?: boolean;
}

export function useProfileEvents<F extends string>({
  fields,
  limit,
  referrer,
  query,
  sort,
  cursor,
  enabled = true,
  refetchOnMount = true,
  datetime,
  projects,
}: UseProfileEventsOptions<F>) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  query = `(has:profile.id OR (has:profiler.id has:thread.id)) ${query ? `(${query})` : ''}`;

  const endpointOptions = {
    query: {
      dataset: 'discover',
      referrer,
      project: projects || selection.projects,
      environment: selection.environments,
      ...normalizeDateTimeParams(datetime ?? selection.datetime),
      field: fields,
      per_page: limit,
      query,
      sort: sort.order === 'asc' ? sort.key : `-${sort.key}`,
      cursor,
    },
  };

  return useApiQuery<EventsResults<F>>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/events/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      endpointOptions,
    ],
    {
      staleTime: 0,
      refetchOnWindowFocus: false,
      refetchOnMount,
      retry: false,
      enabled,
    }
  );
}

export type ProfilingFieldType =
  | 'id'
  | 'trace'
  | 'profile.id'
  | 'profiler.id'
  | 'thread.id'
  | 'precise.start_ts'
  | 'precise.finish_ts'
  | 'project.name'
  | 'timestamp'
  | 'release'
  | 'device.model'
  | 'device.classification'
  | 'device.arch'
  | 'transaction.duration'
  | 'p50()'
  | 'p75()'
  | 'p95()'
  | 'p99()'
  | 'count()'
  | 'last_seen()';

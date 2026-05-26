import {useQuery} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {PageFilters} from 'sentry/types/core';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

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

export function useProfileEventsApiOptions<F extends string>({
  fields,
  limit,
  referrer,
  query,
  sort,
  datetime,
  projects,
  cursor,
}: Pick<
  UseProfileEventsOptions<F>,
  'fields' | 'limit' | 'referrer' | 'query' | 'sort' | 'datetime' | 'projects' | 'cursor'
>) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const fullQuery = `is_transaction:true (has:profile.id OR (has:profiler.id has:thread.id)) ${query ? `(${query})` : ''}`;

  return apiOptions.as<EventsResults<F>>()(
    '/organizations/$organizationIdOrSlug/events/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        dataset: 'spans',
        referrer,
        project: projects || selection.projects,
        environment: selection.environments,
        ...normalizeDateTimeParams(datetime ?? selection.datetime),
        field: fields,
        per_page: limit,
        query: fullQuery,
        sort: sort.order === 'asc' ? sort.key : `-${sort.key}`,
        cursor,
      },
      staleTime: 0,
    }
  );
}

export function useProfileEvents<F extends string>({
  enabled = true,
  refetchOnMount = true,
  ...rest
}: UseProfileEventsOptions<F>) {
  return useQuery({
    ...useProfileEventsApiOptions(rest),
    refetchOnWindowFocus: false,
    refetchOnMount,
    retry: false,
    enabled,
  });
}

type ProfilingFieldType =
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
  | 'count()';

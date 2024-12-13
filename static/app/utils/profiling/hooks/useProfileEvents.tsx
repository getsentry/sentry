import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {mobile} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import type {EventsResults, Sort} from './types';

export interface UseProfileEventsOptions<F extends string = ProfilingFieldType> {
  fields: readonly F[];
  referrer: string;
  sort: Sort<F>;
  cursor?: string;
  datetime?: PageFilters['datetime'];
  enabled?: boolean;
  limit?: number;
  projects?: (number | string)[];
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

  const path = `/organizations/${organization.slug}/events/`;
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

  return useApiQuery<EventsResults<F>>([path, endpointOptions], {
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount,
    retry: false,
    enabled,
  });
}

export function formatError(error: any): string | null {
  if (!defined(error)) {
    return null;
  }

  const detail = error.responseJSON?.detail;
  if (typeof detail === 'string') {
    return detail;
  }

  const message = detail?.message;
  if (typeof message === 'string') {
    return message;
  }

  return t('An unknown error occurred.');
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

export function getProfilesTableFields(platform: Project['platform']) {
  if (mobile.includes(platform as any)) {
    return MOBILE_FIELDS;
  }

  return DEFAULT_FIELDS;
}

const MOBILE_FIELDS: ProfilingFieldType[] = [
  'profile.id',
  'timestamp',
  'release',
  'device.model',
  'device.classification',
  'device.arch',
  'transaction.duration',
];

const DEFAULT_FIELDS: ProfilingFieldType[] = [
  'profile.id',
  'timestamp',
  'release',
  'transaction.duration',
];

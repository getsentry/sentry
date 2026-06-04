import {useQuery} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {PageFilters} from 'sentry/types/core';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {EventsResults, Sort} from './types';

interface UseProfileFunctionsOptions<F extends string> {
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

export function useProfileFunctionsOptions<F extends string>({
  fields,
  referrer,
  sort,
  cursor,
  datetime,
  limit,
  projects,
  query,
}: Pick<
  UseProfileFunctionsOptions<F>,
  'fields' | 'referrer' | 'sort' | 'cursor' | 'datetime' | 'limit' | 'projects' | 'query'
>) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  return apiOptions.as<EventsResults<F>>()(
    '/organizations/$organizationIdOrSlug/events/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        dataset: 'profileFunctions',
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
      staleTime: 0,
    }
  );
}

export function useProfileFunctions<F extends string>({
  enabled,
  refetchOnMount,
  ...rest
}: UseProfileFunctionsOptions<F>) {
  const options = useProfileFunctionsOptions(rest);

  return useQuery({
    ...options,
    refetchOnWindowFocus: false,
    refetchOnMount,
    retry: false,
    enabled,
  });
}

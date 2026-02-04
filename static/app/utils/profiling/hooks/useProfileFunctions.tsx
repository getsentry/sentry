import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

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

export function useProfileFunctions<F extends string>({
  fields,
  referrer,
  sort,
  cursor,
  datetime,
  enabled,
  limit,
  projects,
  query,
  refetchOnMount,
}: UseProfileFunctionsOptions<F>) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const endpointOptions = {
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

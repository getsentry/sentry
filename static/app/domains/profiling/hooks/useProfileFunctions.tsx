import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {PageFilters} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import type {EventsResults, Sort} from './types';

export interface UseProfileFunctionsOptions<F extends string> {
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

  const path = `/organizations/${organization.slug}/events/`;
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

  return useApiQuery<EventsResults<F>>([path, endpointOptions], {
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount,
    retry: false,
    enabled,
  });
}

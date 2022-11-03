import {useQuery} from '@tanstack/react-query';

import {ResponseMeta} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {DURATION_UNITS, SIZE_UNITS} from 'sentry/utils/discover/fieldRenderers';
import {FieldValueType} from 'sentry/utils/fields';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

interface UseProfileEventsOptions<F> {
  fields: readonly F[];
  sort: {
    key: F;
    order: 'asc' | 'desc';
  };
  cursor?: string;
  limit?: number;
  query?: string;
}

type Type = FieldValueType;

type Unit = keyof typeof DURATION_UNITS | keyof typeof SIZE_UNITS | null;

type EventsResultsDataRow<F extends string> = {
  [K in F]: string | number | null;
};

type EventsResultsMeta<F extends string> = {
  fields: {[K in F]: Type};
  units: {[K in F]: Unit};
};

export type EventsResults<F extends string> = {
  data: EventsResultsDataRow<F>[];
  meta: EventsResultsMeta<F>;
};

export function useProfileEvents<F extends string>({
  fields,
  limit,
  query,
  sort,
  cursor,
}: UseProfileEventsOptions<F>) {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const path = `/organizations/${organization.slug}/events/`;
  const endpointOptions = {
    query: {
      dataset: 'profiles',
      project: selection.projects,
      environment: selection.environments,
      ...normalizeDateTimeParams(selection.datetime),
      field: fields,
      per_page: limit,
      query,
      sort: sort.order === 'asc' ? sort.key : `-${sort.key}`,
      cursor,
    },
  };

  const queryKey = [path, endpointOptions];

  const queryFn = () =>
    api.requestPromise(path, {
      method: 'GET',
      includeAllArgs: true,
      query: endpointOptions.query,
    });

  return useQuery<[EventsResults<F>, string | undefined, ResponseMeta | undefined]>({
    queryKey,
    queryFn,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

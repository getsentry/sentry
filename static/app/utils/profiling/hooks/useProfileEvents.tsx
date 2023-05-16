import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import {PageFilters} from 'sentry/types';
import {defined} from 'sentry/utils';
import {DURATION_UNITS, SIZE_UNITS} from 'sentry/utils/discover/fieldRenderers';
import {FieldValueType} from 'sentry/utils/fields';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ProfilingFieldType} from 'sentry/views/profiling/profileSummary/content';

type Sort<F> = {
  key: F;
  order: 'asc' | 'desc';
};

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

type Unit = keyof typeof DURATION_UNITS | keyof typeof SIZE_UNITS | null;

export type EventsResultsDataRow<F extends string = ProfilingFieldType> = {
  [K in F]: string | number | null;
};

type EventsResultsMeta<F extends string> = {
  fields: Partial<{[K in F]: FieldValueType}>;
  units: Partial<{[K in F]: Unit}>;
};

export type EventsResults<F extends string> = {
  data: EventsResultsDataRow<F>[];
  meta: EventsResultsMeta<F>;
};
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

  let dataset: 'profiles' | 'discover' = 'profiles';
  if (organization.features.includes('profiling-using-transactions')) {
    dataset = 'discover';
    query = `has:profile.id ${query ?? ''}`;
  }

  const path = `/organizations/${organization.slug}/events/`;
  const endpointOptions = {
    query: {
      dataset,
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

export function formatSort<F extends string>(
  value: string | undefined,
  allowedKeys: readonly F[],
  fallback: Sort<F>
): Sort<F> {
  value = value || '';
  const order: Sort<F>['order'] = value[0] === '-' ? 'desc' : 'asc';
  const key = order === 'asc' ? value : value.substring(1);

  if (!allowedKeys.includes(key as F)) {
    return fallback;
  }

  return {key: key as F, order};
}

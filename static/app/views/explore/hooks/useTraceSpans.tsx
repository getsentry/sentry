import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import type {TraceResult} from './useTraces';

export type SpanResult<F extends string> = Record<F, any>;

export interface SpanResults<F extends string> {
  data: SpanResult<F>[];
  meta: any;
}

interface UseTraceSpansOptions<F extends string> {
  fields: F[];
  trace: TraceResult;
  dataset?: DiscoverDatasets;
  datetime?: PageFilters['datetime'];
  enabled?: boolean;
  limit?: number;
  query?: string | string[];
  sort?: string[];
}

export function useTraceSpans<F extends string>({
  fields,
  trace,
  dataset,
  datetime,
  enabled,
  limit,
  query,
  sort,
}: UseTraceSpansOptions<F>) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const path = `/organizations/${organization.slug}/trace/${trace.trace}/spans/`;

  const endpointOptions = {
    query: {
      project: selection.projects,
      environment: selection.environments,
      ...normalizeDateTimeParams(datetime ?? selection.datetime),
      dataset,
      field: fields,
      query,
      sort,
      per_page: limit,
      maxSpansPerTrace: 10,
    },
  };

  const result = useApiQuery<SpanResults<F>>([path, endpointOptions], {
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
    enabled,
  });

  return result;
}

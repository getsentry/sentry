import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {QueryError} from 'sentry/utils/discover/genericDiscoverQuery';
import {parseError} from 'sentry/utils/discover/genericDiscoverQuery';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export const BREAKDOWN_SLICES = 40;

interface TraceBreakdownBase {
  duration: number; // Contains the accurate duration for display. Start and end may be quantized.
  end: number;
  opCategory: string | null;
  sdkName: string | null;
  sliceEnd: number;
  sliceStart: number;
  sliceWidth: number;
  start: number;
}

type TraceBreakdownProject = TraceBreakdownBase & {
  kind: 'project';
  project: string;
};

type TraceBreakdownMissing = TraceBreakdownBase & {
  kind: 'missing';
  project: null;
};

export interface TraceResult {
  breakdowns: TraceBreakdownResult[];
  duration: number;
  end: number;
  matchingSpans: number;
  name: string | null;
  numErrors: number;
  numOccurrences: number;
  numSpans: number;
  project: string | null;
  rootDuration: number | null;
  slices: number;
  start: number;
  trace: string;
}

export type TraceBreakdownResult = TraceBreakdownProject | TraceBreakdownMissing;

interface TraceResults {
  data: TraceResult[];
  meta: any;
}

interface UseTracesOptions {
  cursor?: string;
  dataset?: DiscoverDatasets;
  datetime?: PageFilters['datetime'];
  enabled?: boolean;
  limit?: number;
  query?: string | string[];
  sort?: 'timestamp' | '-timestamp';
}

type UseTracesResult = Omit<UseApiQueryResult<TraceResults, RequestError>, 'error'> & {
  error: QueryError | null;
};

export function useTraces({
  cursor,
  dataset,
  datetime,
  enabled,
  limit,
  query,
  sort,
}: UseTracesOptions): UseTracesResult {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const path = `/organizations/${organization.slug}/traces/`;

  const endpointOptions = {
    query: {
      project: selection.projects,
      environment: selection.environments,
      ...normalizeDateTimeParams(datetime ?? selection.datetime),
      dataset,
      query,
      sort, // only has an effect when `dataset` is `EAPSpans`
      per_page: limit,
      cursor,
      breakdownSlices: BREAKDOWN_SLICES,
    },
  };

  const {error, ...rest} = useApiQuery<TraceResults>([path, endpointOptions], {
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
    enabled,
  });

  return {
    ...rest,
    error: parseError(error),
  };
}

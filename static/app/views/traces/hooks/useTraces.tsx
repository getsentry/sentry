import {useEffect} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';

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
  datetime?: PageFilters['datetime'];
  enabled?: boolean;
  limit?: number;
  query?: string | string[];
}

export function useTraces({datetime, enabled, limit, query}: UseTracesOptions) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const {selection} = usePageFilters();

  const path = `/organizations/${organization.slug}/traces/`;

  const endpointOptions = {
    query: {
      project: selection.projects,
      environment: selection.environments,
      ...normalizeDateTimeParams(datetime ?? selection.datetime),
      query,
      per_page: limit,
      breakdownSlices: BREAKDOWN_SLICES,
    },
  };

  const serializedEndpointOptions = JSON.stringify(endpointOptions);

  let queries: string[] = [];
  if (Array.isArray(query)) {
    queries = query;
  } else if (query !== undefined) {
    queries = [query];
  }

  useEffect(() => {
    trackAnalytics('trace_explorer.search_request', {
      organization,
      queries,
    });
    // `queries` is already included as a dep in serializedEndpointOptions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serializedEndpointOptions, organization]);

  const result = useApiQuery<TraceResults>([path, endpointOptions], {
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
    enabled,
  });

  useEffect(() => {
    if (result.status === 'success') {
      const project_slugs = [...new Set(result.data.data.map(trace => trace.project))];
      const project_platforms = projects
        .filter(p => project_slugs.includes(p.slug))
        .map(p => p.platform ?? '');

      trackAnalytics('trace_explorer.search_success', {
        organization,
        queries,
        has_data: result.data.data.length > 0,
        num_traces: result.data.data.length,
        num_missing_trace_root: result.data.data.filter(trace => trace.name === null)
          .length,
        project_platforms,
      });
    } else if (result.status === 'error') {
      const response = result.error.responseJSON;
      const error =
        typeof response?.detail === 'string'
          ? response?.detail
          : response?.detail?.message;
      trackAnalytics('trace_explorer.search_failure', {
        organization,
        queries,
        error: error ?? '',
      });
    }
    // result.status is tied to result.data. No need to explicitly
    // include result.data as an additional dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serializedEndpointOptions, result.status, organization]);

  return result;
}

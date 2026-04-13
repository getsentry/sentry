import {queryOptions} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {CaseInsensitive} from 'sentry/components/searchQueryBuilder/hooks';
import type {PageFilters} from 'sentry/types/core';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useOrganization} from 'sentry/utils/useOrganization';

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

type TraceBreakdownResult = TraceBreakdownProject | TraceBreakdownMissing;

export interface TraceResults {
  data: TraceResult[];
  meta: any;
}

interface UseTracesOptions {
  caseInsensitive?: CaseInsensitive;
  cursor?: string;
  datetime?: PageFilters['datetime'];
  limit?: number;
  logQuery?: string[];
  metricQuery?: string[];
  query?: string | string[];
  sort?: 'timestamp' | '-timestamp';
  spanQuery?: string[];
}

export function useTracesApiOptions({
  caseInsensitive,
  cursor,
  datetime,
  limit,
  query,
  sort,
  logQuery,
  metricQuery,
  spanQuery,
}: UseTracesOptions) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  return queryOptions({
    ...apiOptions.as<TraceResults>()('/organizations/$organizationIdOrSlug/traces/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        project: selection.projects,
        environment: selection.environments,
        ...normalizeDateTimeParams(datetime ?? selection.datetime),
        dataset: DiscoverDatasets.SPANS,
        query,
        sort,
        per_page: limit,
        cursor,
        breakdownSlices: BREAKDOWN_SLICES,
        caseInsensitive: caseInsensitive ? '1' : undefined,
        ...(Array.isArray(logQuery) && logQuery.length > 0 ? {logQuery} : {}),
        ...(Array.isArray(metricQuery) && metricQuery.length > 0 ? {metricQuery} : {}),
        ...(Array.isArray(spanQuery) && spanQuery.length > 0 ? {spanQuery} : {}),
      },
      staleTime: 0,
    }),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
  });
}

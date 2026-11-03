import {useMemo} from 'react';

import type {
  TraceItemResponseAttribute,
  TraceItemResponseLink,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {getSpanLinkType} from 'sentry/views/performance/traceDetails/getSpanLinkType';
import type {ConnectedTraceConnection} from 'sentry/views/performance/traceDetails/traceLinksNavigation/types';

/**
 * Find an adjacent trace (next or previous) by querying the spans endpoint.
 * For 'next' traces: looks for a trace linking to the current trace as its previous trace.
 * For 'previous' traces: looks for the trace in the root span's `previous_trace` link.
 */
export function useFindAdjacentTrace({
  direction,
  attributes,
  links,
  adjacentTraceEndTimestamp,
  adjacentTraceStartTimestamp,
}: {
  adjacentTraceEndTimestamp: number;
  adjacentTraceStartTimestamp: number;
  attributes: TraceItemResponseAttribute[];
  direction: ConnectedTraceConnection;
  links?: TraceItemResponseLink[];
}): {
  available: boolean;
  isLoading: boolean;
  id?: string;
  trace?: string;
} {
  const {
    projectId,
    currentTraceId,
    adjacentTraceId,
    adjacentTraceSpanId,
    hasAdjacentTraceLink,
    adjacentTraceSampled,
  } = useMemo(() => {
    let _projectId: number | undefined;
    let _currentTraceId: string | undefined;

    for (const a of attributes ?? []) {
      if (a.name === 'project_id' && a.type === 'int') {
        _projectId = a.value;
      } else if (a.name === 'trace' && a.type === 'str') {
        _currentTraceId = a.value;
      }
    }

    const previousTraceLink = links?.find(
      link => getSpanLinkType(link) === 'previous_trace'
    );

    return {
      projectId: _projectId,
      currentTraceId: _currentTraceId,
      hasAdjacentTraceLink: previousTraceLink !== undefined,
      // When the sampling decision is unknown, we still query. Result tells us if the previous trace exists.
      adjacentTraceSampled: previousTraceLink?.sampled !== false,
      adjacentTraceId: previousTraceLink?.traceId,
      adjacentTraceSpanId: previousTraceLink?.itemId,
    };
  }, [attributes, links]);

  const searchQuery =
    direction === 'next'
      ? // `sentry.links` only allows a wildcard search on private JSON, which cannot
        // filter by link type or sampling. Search the SDK's flat attribute instead,
        // until EAP supports span links as objects.
        //
        // relaxed the next trace lookup to match spans containing only the
        // traceId and not the spanId of the current trace root. We can't
        // always be sure that the current trace root is indeed the span the
        // next span would link towards, because sometimes the root might be a web
        // vital span instead of the actual intial span from the SDK's perspective.
        `sentry.previous_trace:${currentTraceId}-*-1`
      : `id:${adjacentTraceSpanId} trace:${adjacentTraceId}`;

  const enabled =
    direction === 'next'
      ? !!projectId
      : hasAdjacentTraceLink &&
        adjacentTraceSampled &&
        !!adjacentTraceSpanId &&
        !!adjacentTraceId;

  const {data, isError, isPending} = useSpans(
    {
      search: searchQuery,
      fields: ['id', 'trace'],
      limit: 1,
      enabled,
      projectIds: projectId ? [projectId] : [],
      pageFilters: {
        environments: [],
        projects: projectId ? [projectId] : [],
        datetime: {
          start: adjacentTraceStartTimestamp
            ? new Date(adjacentTraceStartTimestamp * 1000).toISOString()
            : '',
          end: adjacentTraceEndTimestamp
            ? new Date(adjacentTraceEndTimestamp * 1000).toISOString()
            : '',
          period: null,
          utc: true,
        },
      },
      queryWithoutPageFilters: true,
    },
    `api.insights.trace-panel-${direction}-trace-link`
  );

  const spanId = data?.[0]?.id;
  const traceId = data?.[0]?.trace;

  return useMemo(() => {
    if (direction === 'next') {
      return {
        id: spanId,
        trace: traceId,
        available: !!spanId && !!traceId && !isError,
        isLoading: enabled && isPending,
      };
    }

    return {
      trace: adjacentTraceId,
      id: adjacentTraceSpanId,
      available: !!data?.[0]?.id && !isError,
      isLoading: enabled && isPending,
    };
  }, [
    direction,
    spanId,
    traceId,
    adjacentTraceId,
    adjacentTraceSpanId,
    data,
    enabled,
    isError,
    isPending,
  ]);
}

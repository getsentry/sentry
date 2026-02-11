import {useMemo} from 'react';

import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';

import type {ConnectedTraceConnection} from './traceLinkNavigationButton';

/**
 * Find an adjacent trace (next or previous) by querying the spans endpoint.
 * For 'next' traces: looks for a trace linking to the current trace as its previous trace.
 * For 'previous' traces: looks for the trace specified in the previous_trace attribute.
 */
export function useFindAdjacentTrace({
  direction,
  attributes,
  adjacentTraceEndTimestamp,
  adjacentTraceStartTimestamp,
}: {
  adjacentTraceEndTimestamp: number;
  adjacentTraceStartTimestamp: number;
  attributes: TraceItemResponseAttribute[];
  direction: ConnectedTraceConnection;
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
    let _projectId: number | undefined = undefined;
    let _currentTraceId: string | undefined;
    let _adjacentTraceAttribute: TraceItemResponseAttribute | undefined = undefined;

    for (const a of attributes ?? []) {
      if (a.name === 'project_id' && a.type === 'int') {
        _projectId = a.value;
      } else if (a.name === 'trace' && a.type === 'str') {
        _currentTraceId = a.value;
      } else if (a.name === 'previous_trace' && a.type === 'str') {
        _adjacentTraceAttribute = a;
      }
    }

    const _hasAdjacentTraceLink = typeof _adjacentTraceAttribute?.value === 'string';

    // In case the attribute value does not conform to `[traceId]-[spanId]-[sampledFlag]`,
    // the split operation will return an array with different length or unexpected contents.
    // For cases where we only get partial, empty or too long arrays, we should be safe because we
    // only take the first three elements. If any of the elements are empty or undefined, we'll
    // disable the query (see below).
    // Worst-case, we get invalid ids and query for those. Since we check for `isError` below,
    // we handle that case gracefully. Likewise we handle the case of getting an empty result.
    // So all in all, this should be safe and we don't have to do further validation on the
    // attribute content.
    const [_adjacentTraceId, _adjacentTraceSpanId, _adjacentTraceSampledFlag] =
      _hasAdjacentTraceLink ? _adjacentTraceAttribute?.value.split('-') || [] : [];

    return {
      projectId: _projectId,
      currentTraceId: _currentTraceId,
      hasAdjacentTraceLink: _hasAdjacentTraceLink,
      adjacentTraceSampled: _adjacentTraceSampledFlag === '1',
      adjacentTraceId: _adjacentTraceId,
      adjacentTraceSpanId: _adjacentTraceSpanId,
    };
  }, [attributes]);

  const searchQuery =
    direction === 'next'
      ? // relaxed the next trace lookup to match spans containing only the
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
        isLoading: isPending,
      };
    }

    return {
      trace: adjacentTraceId,
      id: adjacentTraceSpanId,
      available: !!data?.[0]?.id && !isError,
      isLoading: isPending,
    };
  }, [
    direction,
    spanId,
    traceId,
    adjacentTraceId,
    adjacentTraceSpanId,
    data,
    isError,
    isPending,
  ]);
}

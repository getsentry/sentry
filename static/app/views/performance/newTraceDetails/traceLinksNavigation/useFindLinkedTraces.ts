import {useMemo} from 'react';

import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';

import type {ConnectedTraceConnection} from './traceLinkNavigationButton';

/**
 * Find the next trace by looking using the spans endpoint to query for a trace
 * linking to the current trace as its previous trace.
 */
export function useFindNextTrace({
  direction,
  attributes,
  nextTraceEndTimestamp,
  nextTraceStartTimestamp,
}: {
  attributes: TraceItemResponseAttribute[];
  direction: ConnectedTraceConnection;
  nextTraceEndTimestamp: number;
  nextTraceStartTimestamp: number;
}): {isLoading: boolean; id?: string; trace?: string} {
  const {currentTraceId, currentSpanId, projectId, environment} = useMemo(() => {
    let _currentTraceId: string | undefined;
    let _currentSpanId: string | undefined;
    let _projectId: number | undefined;
    let _environment: string | undefined;

    for (const a of attributes) {
      if (a.name === 'trace' && a.type === 'str') {
        _currentTraceId = a.value;
      } else if (a.name === 'transaction.span_id' && a.type === 'str') {
        _currentSpanId = a.value;
      } else if (a.name === 'project_id' && a.type === 'int') {
        _projectId = a.value;
      } else if (a.name === 'environment' && a.type === 'str') {
        _environment = a.value;
      }
    }
    return {
      currentTraceId: _currentTraceId,
      currentSpanId: _currentSpanId,
      projectId: _projectId,
      environment: _environment,
    };
  }, [attributes]);

  const {data, isError, isPending} = useSpans(
    {
      search: `sentry.previous_trace:${currentTraceId}-${currentSpanId}-1`,
      fields: ['id', 'trace'],
      limit: 1,
      enabled: direction === 'next' && !!projectId,
      projectIds: projectId ? [projectId] : [],
      pageFilters: {
        environments: environment ? [environment] : [],
        projects: projectId ? [projectId] : [],
        datetime: {
          start: nextTraceStartTimestamp
            ? new Date(nextTraceStartTimestamp * 1000).toISOString()
            : '',
          end: nextTraceEndTimestamp
            ? new Date(nextTraceEndTimestamp * 1000).toISOString()
            : '',
          period: null,
          utc: true,
        },
      },
      queryWithoutPageFilters: true,
    },
    `api.performance.trace-panel-${direction}-trace-link`
  );

  const spanId = data?.[0]?.id;
  const traceId = data?.[0]?.trace;

  const nextTraceData = useMemo(() => {
    if (!spanId || !traceId || isError || isPending) {
      return {
        id: undefined,
        trace: undefined,
        isLoading: isPending,
      };
    }
    return {
      id: spanId,
      trace: traceId,
      isLoading: false,
    };
  }, [spanId, traceId, isError, isPending]);

  return nextTraceData;
}

export function useFindPreviousTrace({
  direction,
  attributes,
  previousTraceEndTimestamp,
  previousTraceStartTimestamp,
}: {
  attributes: TraceItemResponseAttribute[];
  direction: ConnectedTraceConnection;
  previousTraceEndTimestamp: number;
  previousTraceStartTimestamp: number;
}): {
  available: boolean;
  isLoading: boolean;
  sampled: boolean;
  id?: string;
  trace?: string;
} {
  const {
    projectId,
    environment,
    previousTraceId,
    previousTraceSpanId,
    hasPreviousTraceLink,
    previousTraceSampled,
  } = useMemo(() => {
    let _projectId: number | undefined = undefined;
    let _environment: string | undefined = undefined;
    let _previousTraceAttribute: TraceItemResponseAttribute | undefined = undefined;

    for (const a of attributes ?? []) {
      if (a.name === 'project_id' && a.type === 'int') {
        _projectId = a.value;
      } else if (a.name === 'environment' && a.type === 'str') {
        _environment = a.value;
      } else if (a.name === 'previous_trace' && a.type === 'str') {
        _previousTraceAttribute = a;
      }
    }

    const _hasPreviousTraceLink = typeof _previousTraceAttribute?.value === 'string';

    // In case the attribute value does not conform to `[traceId]-[spanId]-[sampledFlag]`,
    // the split operation will return an array with different length or unexpected contents.
    // For cases where we only get partial, empty or too long arrays, we should be safe because we
    // only take the first three elements. If any of the elements are empty or undefined, we'll
    // disable the query (see below).
    // Worst-case, we get invalid ids and query for those. Since we check for `isError` below,
    // we handle that case gracefully. Likewise we handle the case of getting an empty result.
    // So all in all, this should be safe and we don't have to do further validation on the
    // attribute content.
    const [_previousTraceId, _previousTraceSpanId, _previousTraceSampledFlag] =
      _hasPreviousTraceLink ? _previousTraceAttribute?.value.split('-') || [] : [];

    return {
      projectId: _projectId,
      environment: _environment,
      hasPreviousTraceLink: _hasPreviousTraceLink,
      previousTraceSampled: _previousTraceSampledFlag === '1',
      previousTraceId: _previousTraceId,
      previousTraceSpanId: _previousTraceSpanId,
    };
  }, [attributes]);

  const {data, isError, isPending} = useSpans(
    {
      search: `id:${previousTraceSpanId} trace:${previousTraceId}`,
      fields: ['id', 'trace'],
      limit: 1,
      enabled:
        direction === 'previous' &&
        hasPreviousTraceLink &&
        previousTraceSampled &&
        !!previousTraceSpanId &&
        !!previousTraceId,
      projectIds: projectId ? [projectId] : [],
      pageFilters: {
        environments: environment ? [environment] : [],
        projects: projectId ? [projectId] : [],
        datetime: {
          start: new Date(previousTraceStartTimestamp * 1000).toISOString(),
          end: new Date(previousTraceEndTimestamp * 1000).toISOString(),
          period: null,
          utc: true,
        },
      },
      queryWithoutPageFilters: true,
    },
    `api.performance.trace-panel-${direction}-trace-link`
  );

  return {
    trace: previousTraceId,
    id: previousTraceSpanId,
    available: !!data?.[0]?.id && !isError,
    sampled: previousTraceSampled,
    isLoading: isPending,
  };
}

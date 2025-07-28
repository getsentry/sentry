import {useMemo} from 'react';

import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useTrace} from 'sentry/views/performance/newTraceDetails/traceApi/useTrace';
import {isEmptyTrace} from 'sentry/views/performance/newTraceDetails/traceApi/utils';

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
  direction: ConnectedTraceConnection;
  nextTraceEndTimestamp: number;
  nextTraceStartTimestamp: number;
  attributes?: TraceItemResponseAttribute[];
}): {isLoading: boolean; id?: string; trace?: string} {
  const currentTraceId = attributes?.find(a => a.name === 'trace' && a.type === 'str')
    ?.value as string | undefined;

  const currentSpanId = attributes?.find(
    a => a.name === 'transaction.span_id' && a.type === 'str'
  )?.value as string | undefined;

  const projectId = attributes?.find(a => a.name === 'project_id' && a.type === 'int')
    ?.value as number | undefined;

  const environment = attributes?.find(a => a.name === 'environment' && a.type === 'str')
    ?.value as string | undefined;

  const {data, isError, isPending} = useSpans(
    {
      search: `sentry.previous_trace:${currentTraceId}-${currentSpanId}-1`,
      fields: ['id', 'trace'],
      limit: 1,
      enabled: direction === 'next' && !!projectId,
      projectIds: [projectId ?? 0],
      pageFilters: {
        environments: [environment ?? ''],
        projects: [projectId ?? 0],
        datetime: {
          start: nextTraceStartTimestamp
            ? new Date(nextTraceStartTimestamp * 1000).toISOString()
            : '',
          end: nextTraceEndTimestamp
            ? new Date(nextTraceEndTimestamp * 1000).toISOString()
            : '',
          period: '1d',
          utc: true,
        },
      },
      queryWithoutPageFilters: true,
    },
    `api.performance.trace-panel-${direction}-trace-link`
  );

  const nextTraceData = useMemo(() => {
    if (!data?.[0]?.id || !data?.[0]?.trace || isError || isPending) {
      return {
        id: undefined,
        trace: undefined,
        isLoading: isPending,
      };
    }
    return {
      id: data[0].id,
      trace: data[0].trace,
      isLoading: false,
    };
  }, [data, isError, isPending]);

  return nextTraceData;
}

export function useFindPreviousTrace({
  direction,
  attributes,
  linkedTraceTimestamp,
}: {
  direction: ConnectedTraceConnection;
  attributes?: TraceItemResponseAttribute[];
  linkedTraceTimestamp?: number;
}): {
  available: boolean;
  isLoading: boolean;
  sampled: boolean;
  id?: string;
  trace?: string;
} {
  const previousTraceAttribute = useMemo(
    () => attributes?.find(a => a.name === 'previous_trace' && a.type === 'str'),
    [attributes]
  );

  const hasPreviousTraceLink = typeof previousTraceAttribute?.value === 'string';

  const [previousTraceId, previousTraceSpanId, previousTraceSampledFlag] =
    hasPreviousTraceLink ? previousTraceAttribute?.value.split('-') || [] : [];

  const sampled = previousTraceSampledFlag === '1';

  const queryFn =
    direction === 'previous' && hasPreviousTraceLink && sampled
      ? useIsTraceAvailable
      : () => ({
          isAvailable: false,
          isLoading: false,
        });

  const {isAvailable, isLoading} = queryFn(previousTraceId, linkedTraceTimestamp);

  return {
    trace: previousTraceId,
    id: previousTraceSpanId,
    available: isAvailable,
    sampled,
    isLoading,
  };
}

function useIsTraceAvailable(
  traceID?: string,
  linkedTraceTimestamp?: number
): {
  isAvailable: boolean;
  isLoading: boolean;
} {
  const trace = useTrace({
    traceSlug: traceID,
    timestamp: linkedTraceTimestamp,
  });

  const isAvailable = useMemo(() => {
    if (!traceID) {
      return false;
    }

    return Boolean(trace.data && !isEmptyTrace(trace.data));
  }, [traceID, trace]);

  return {
    isAvailable,
    isLoading: trace.isLoading,
  };
}

import {useMemo} from 'react';
import type {Location} from 'history';
import * as qs from 'query-string';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import type {PageFilters} from 'sentry/types/core';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useDefaultMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {useIsEAPTraceEnabled} from 'sentry/views/performance/newTraceDetails/useIsEAPTraceEnabled';

import type {TraceSplitResults} from './types';

const DEFAULT_TIMESTAMP_LIMIT = 10_000;
const DEFAULT_LIMIT = 1_000;

type TraceQueryParamOptions = {
  limit?: number;
  targetId?: string;
  timestamp?: number;
};

function getTargetIdParams(
  traceType: 'eap' | 'non-eap',
  options: TraceQueryParamOptions,
  normalizedParams: ReturnType<typeof normalizeDateTimeParams>
): {targetId?: string} | {errorId?: string} {
  // Node params occur in the format `${event-type}-${eventId}`, where the most relevant event is the last one in the array.
  // If not an array, it is a string with the same format.
  const nodeParams = normalizedParams.node;
  const targetIdFromNodeParams = Array.isArray(nodeParams)
    ? nodeParams[nodeParams.length - 1]?.split('-')[1]
    : typeof nodeParams === 'string'
      ? nodeParams.split('-')[1]
      : undefined;

  // We try our best to pass a target event id to the trace query.
  // We first check if targetId is passed in the options, then we check for
  // targetId/eventId in the query params, lastly we check for the node params.
  const targetId =
    options.targetId ??
    decodeScalar(normalizedParams.targetId ?? normalizedParams.eventId) ??
    targetIdFromNodeParams;

  if (!targetId) {
    return {};
  }

  if (traceType === 'eap') {
    return isValidEventUUID(targetId) ? {errorId: targetId} : {};
  }

  return {targetId};
}

type TraceQueryParams = {
  limit: number;
  pageEnd?: string;
  pageStart?: string;
  statsPeriod?: string;
  timestamp?: string;
} & ({targetId?: string} | {errorId?: string});

export function getTraceQueryParams(
  traceType: 'eap' | 'non-eap',
  query: Location['query'],
  filters?: Partial<PageFilters>,
  options: TraceQueryParamOptions = {}
): TraceQueryParams {
  const normalizedParams = normalizeDateTimeParams(query, {
    allowAbsolutePageDatetime: true,
  });
  const statsPeriod = decodeScalar(normalizedParams.statsPeriod);

  const timestamp = options.timestamp ?? decodeScalar(normalizedParams.timestamp);
  let limit = options.limit ?? decodeScalar(normalizedParams.limit);
  if (typeof limit === 'string') {
    limit = parseInt(limit, 10);
  }
  if (timestamp) {
    limit = limit ?? DEFAULT_TIMESTAMP_LIMIT;
  } else {
    limit = limit ?? DEFAULT_LIMIT;
  }

  const timeRangeParams: Record<string, string | string[] | undefined | null> = {
    end: normalizedParams.pageEnd,
    start: normalizedParams.pageStart,
    statsPeriod: statsPeriod || filters?.datetime?.period,
  };

  // We prioritize timestamp over statsPeriod as it makes the query more specific, faster
  // and not prone to time drift issues.
  if (timestamp) {
    delete timeRangeParams.statsPeriod;
  }

  const targetEventParams = getTargetIdParams(traceType, options, normalizedParams);

  const queryParams = {
    ...timeRangeParams,
    ...targetEventParams,
    limit,
    timestamp: timestamp?.toString(),
    include_uptime: '1',
  };

  for (const key in queryParams) {
    if (
      queryParams[key as keyof typeof queryParams] === '' ||
      queryParams[key as keyof typeof queryParams] === null ||
      queryParams[key as keyof typeof queryParams] === undefined
    ) {
      delete queryParams[key as keyof typeof queryParams];
    }
  }

  return queryParams;
}

type UseTraceOptions = {
  additionalAttributes?: string[];
  limit?: number;
  referrer?: string;
  /**
   * When passed we make sure that the corresponding event is a part of the trace (if it exists)
   * irrespective of the trace query count limit.
   */
  targetEventId?: string;
  timestamp?: number;
  traceSlug?: string;
};

export type TraceQueryResult = UseApiQueryResult<TraceTree.Trace, RequestError>;

export function useTrace(options: UseTraceOptions): TraceQueryResult {
  const filters = usePageFilters();
  const organization = useOrganization();
  const query = qs.parse(location.search);

  const isEAPEnabled = useIsEAPTraceEnabled();
  const hasValidTrace = Boolean(options.traceSlug && organization.slug);

  const queryParams = useMemo(() => {
    return getTraceQueryParams(
      isEAPEnabled ? 'eap' : 'non-eap',
      query,
      filters.selection,
      {
        limit: options.limit,
        timestamp: options.timestamp,
        targetId: options.targetEventId,
      }
    );

    // Only re-run this if the view query param changes, otherwise if we pass location.search
    // as a dependency, the query will re-run every time we perform actions on the trace view; like
    // clicking on a span, that updates the url.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    options.limit,
    options.timestamp,
    options.targetEventId,
    isEAPEnabled,
    filters.selection,
  ]);

  const maxPickableDays = useDefaultMaxPickableDays();

  // Only retry when using statsPeriod (no specific timestamp or absolute date range)
  // and only when the org's plan allows a wider window than the default stats period.
  const defaultStatsDays = parseInt(DEFAULT_STATS_PERIOD, 10);
  const canRetryWithWiderPeriod =
    !options.timestamp &&
    'statsPeriod' in queryParams &&
    maxPickableDays > defaultStatsDays;

  const fallbackQueryParams = useMemo(
    () => ({
      ...queryParams,
      statsPeriod: `${maxPickableDays}d`,
      referrer: options.referrer,
    }),
    [queryParams, maxPickableDays, options.referrer]
  );

  const traceQuery = useApiQuery<TraceSplitResults<TraceTree.Transaction>>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/events-trace/$traceId/', {
        path: {organizationIdOrSlug: organization.slug, traceId: options.traceSlug ?? ''},
      }),
      {query: {...queryParams, referrer: options.referrer}},
    ],
    {
      staleTime: Infinity,
      enabled: hasValidTrace && !isEAPEnabled,
    }
  );

  const eapTraceQuery = useApiQuery<TraceTree.EAPTrace>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/trace/$traceId/', {
        path: {organizationIdOrSlug: organization.slug, traceId: options.traceSlug ?? ''},
      }),
      {
        query: {
          ...queryParams,
          project: -1,
          additional_attributes: options.additionalAttributes,
          referrer: options.referrer,
        },
      },
    ],
    {
      staleTime: Infinity,
      retry: false,
      enabled: hasValidTrace && isEAPEnabled,
    }
  );

  const isInitialTraceEmpty =
    traceQuery.status === 'success' &&
    traceQuery.data?.transactions?.length === 0 &&
    traceQuery.data?.orphan_errors?.length === 0;

  const isInitialEAPTraceEmpty =
    eapTraceQuery.status === 'success' &&
    Array.isArray(eapTraceQuery.data) &&
    eapTraceQuery.data.length === 0;

  const traceFallbackQuery = useApiQuery<TraceSplitResults<TraceTree.Transaction>>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/events-trace/$traceId/', {
        path: {organizationIdOrSlug: organization.slug, traceId: options.traceSlug ?? ''},
      }),
      {query: fallbackQueryParams},
    ],
    {
      staleTime: Infinity,
      enabled:
        hasValidTrace && !isEAPEnabled && isInitialTraceEmpty && canRetryWithWiderPeriod,
    }
  );

  const eapTraceFallbackQuery = useApiQuery<TraceTree.EAPTrace>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/trace/$traceId/', {
        path: {organizationIdOrSlug: organization.slug, traceId: options.traceSlug ?? ''},
      }),
      {
        query: {
          ...fallbackQueryParams,
          project: -1,
          additional_attributes: options.additionalAttributes,
        },
      },
    ],
    {
      staleTime: Infinity,
      retry: false,
      enabled:
        hasValidTrace &&
        isEAPEnabled &&
        isInitialEAPTraceEmpty &&
        canRetryWithWiderPeriod,
    }
  );

  if (isEAPEnabled) {
    return isInitialEAPTraceEmpty && canRetryWithWiderPeriod
      ? eapTraceFallbackQuery
      : eapTraceQuery;
  }
  return isInitialTraceEmpty && canRetryWithWiderPeriod ? traceFallbackQuery : traceQuery;
}

const isValidEventUUID = (id: string): boolean => {
  const uuidRegex =
    /^[0-9a-f]{8}[0-9a-f]{4}[1-5][0-9a-f]{3}[89ab][0-9a-f]{3}[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

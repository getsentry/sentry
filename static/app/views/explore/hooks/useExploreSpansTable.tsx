import {useCallback, useMemo, useState} from 'react';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {NewQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils/defined';
import {EventView, type EventData} from 'sentry/utils/discover/eventView';
import {
  useProgressiveQuery,
  type RPCQueryExtras,
} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {
  useQueryParamsCursor,
  useQueryParamsExtrapolate,
  useQueryParamsFields,
  useQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';
import {useSpansDataset} from 'sentry/views/explore/spans/spansQueryParams';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';

interface UseExploreSpansTableOptions {
  enabled: boolean;
  limit: number;
  query: string;
  queryExtras?: RPCQueryExtras;
}

interface UseExploreSpansTableImpOptions extends UseExploreSpansTableOptions {
  cursor?: string;
}

export interface SpansTableResult {
  eventView: EventView;
  result: ReturnType<typeof useSpansQuery<EventData[]>>;
  requestIdentityKey?: string;
}

interface ResolvedSpanSamples {
  data: EventData[];
  fieldsKey: string;
  identityKey: string;
  pageLinks: string | undefined;
  spanIds: string[];
}

interface SpanSamplesRequestState {
  lastResolved: ResolvedSpanSamples | null;
  lockedSamples: {
    identityKey: string;
    pageLinks: string | undefined;
    spanIds: string[];
  } | null;
}

export function useExploreSpansTable({
  enabled,
  limit,
  query,
  queryExtras,
}: UseExploreSpansTableOptions) {
  const {selection} = usePageFilters();
  const extrapolate = useQueryParamsExtrapolate();
  const cursor = useQueryParamsCursor();
  const dataset = useSpansDataset();
  const fields = useQueryParamsFields();
  const sortBys = useQueryParamsSortBys();

  const fieldsKey = JSON.stringify(fields);
  const identityKey = useMemo(
    () =>
      JSON.stringify([
        cursor,
        dataset,
        extrapolate,
        limit,
        query,
        queryExtras,
        selection.datetime,
        selection.environments,
        selection.projects,
        sortBys,
      ]),
    [cursor, dataset, extrapolate, limit, query, queryExtras, selection, sortBys]
  );
  const [requestState, setRequestState] = useState<SpanSamplesRequestState>({
    lastResolved: null,
    lockedSamples: null,
  });

  const visibleSamples = useMemo(() => {
    if (requestState.lockedSamples?.identityKey === identityKey) {
      return requestState.lockedSamples;
    }

    if (
      requestState.lastResolved?.identityKey === identityKey &&
      requestState.lastResolved.fieldsKey !== fieldsKey &&
      requestState.lastResolved.spanIds.length > 0
    ) {
      return {
        identityKey,
        pageLinks: requestState.lastResolved.pageLinks,
        spanIds: requestState.lastResolved.spanIds,
      };
    }

    return;
  }, [fieldsKey, identityKey, requestState]);
  const constrainedQuery = visibleSamples
    ? [query ? `(${query})` : '', `id:[${visibleSamples.spanIds.join(',')}]`]
        .filter(Boolean)
        .join(' ')
    : query;

  const canTriggerHighAccuracy = useCallback(
    (results: ReturnType<typeof useSpansQuery<EventData[]>>) => {
      const canGoToHigherAccuracyTier = results.meta?.dataScanned === 'partial';
      const hasData = defined(results.data) && results.data.length > 0;
      return !hasData && canGoToHigherAccuracyTier;
    },
    []
  );

  const spansTableResult = useProgressiveQuery<typeof useExploreSpansTableImp>({
    queryHookImplementation: useExploreSpansTableImp,
    queryHookArgs: {
      cursor: visibleSamples ? '' : undefined,
      enabled,
      limit,
      query: constrainedQuery,
      queryExtras,
    },
    queryOptions: {
      canTriggerHighAccuracy,
      disableExtrapolation: !extrapolate,
    },
  });

  const resolvedSamples = useMemo<ResolvedSpanSamples | null>(() => {
    const {result} = spansTableResult;
    if (!enabled || !result.isSuccess || result.isPlaceholderData || !result.data) {
      return null;
    }

    const spanIds = Array.from(
      new Set(
        result.data
          .map(row => row.id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    );

    return {
      data: result.data,
      fieldsKey,
      identityKey,
      pageLinks: result.pageLinks,
      spanIds,
    };
  }, [enabled, fieldsKey, identityKey, spansTableResult]);

  const shouldUpdateLastResolved =
    resolvedSamples !== null &&
    (requestState.lastResolved?.data !== resolvedSamples.data ||
      requestState.lastResolved.fieldsKey !== resolvedSamples.fieldsKey ||
      requestState.lastResolved.identityKey !== resolvedSamples.identityKey);
  const shouldLockVisibleSamples =
    visibleSamples !== undefined && requestState.lockedSamples !== visibleSamples;
  const shouldClearLockedSamples =
    requestState.lockedSamples !== null &&
    requestState.lockedSamples.identityKey !== identityKey;

  if (shouldUpdateLastResolved || shouldLockVisibleSamples || shouldClearLockedSamples) {
    setRequestState({
      lastResolved: shouldUpdateLastResolved
        ? resolvedSamples
        : requestState.lastResolved,
      lockedSamples: shouldLockVisibleSamples
        ? visibleSamples
        : shouldClearLockedSamples
          ? null
          : requestState.lockedSamples,
    });
  }

  return useMemo(() => {
    if (!visibleSamples) {
      return {...spansTableResult, requestIdentityKey: identityKey};
    }

    // The constrained response only describes pagination within the visible IDs.
    // Keep the links from the original response so pagination can leave the lock.
    return {
      ...spansTableResult,
      requestIdentityKey: visibleSamples.identityKey,
      result: {
        ...spansTableResult.result,
        pageLinks: visibleSamples.pageLinks,
      },
    };
  }, [identityKey, spansTableResult, visibleSamples]);
}

function useExploreSpansTableImp({
  cursor,
  enabled,
  limit,
  query,
  queryExtras,
}: UseExploreSpansTableImpOptions): SpansTableResult {
  const {selection} = usePageFilters();

  const dataset = useSpansDataset();
  const fields = useQueryParamsFields();
  const sortBys = useQueryParamsSortBys();

  const visibleFields = useMemo(
    () => (fields.includes('id') ? fields : ['id', ...fields]),
    [fields]
  );

  const eventView = useMemo(() => {
    const queryFields = [
      ...visibleFields,
      'project',
      'trace',
      'transaction.span_id',
      'id',
      'timestamp',
    ];

    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'Explore - Span Samples',
      fields: queryFields,
      orderby: sortBys.map(sort => `${sort.kind === 'desc' ? '-' : ''}${sort.field}`),
      query,
      version: 2,
      dataset,
    };

    return EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
  }, [dataset, query, selection, sortBys, visibleFields]);

  const result = useSpansQuery<EventData[]>({
    cursor,
    enabled,
    eventView,
    initialData: [],
    keepPreviousData: true,
    limit,
    referrer: 'api.explore.spans-samples-table',
    allowAggregateConditions: false,
    trackResponseAnalytics: false,
    queryExtras,
  });

  return useMemo(() => {
    return {eventView, result};
  }, [eventView, result]);
}

import {useCallback, useMemo} from 'react';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {defined} from 'sentry/utils';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {EventsMetaType, EventView} from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {useApiQuery, type ApiQueryKey} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import type {RPCQueryExtras} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {
  SAMPLING_MODE,
  useProgressiveQuery,
} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {AlwaysPresentTraceMetricFields} from 'sentry/views/explore/metrics/constants';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {
  useMetricsFrozenSearch,
  useMetricsFrozenTracePeriod,
} from 'sentry/views/explore/metrics/metricsFrozenContext';
import {NONE_UNIT} from 'sentry/views/explore/metrics/metricToolbar/metricSelector';
import {
  TraceMetricKnownFieldKey,
  type TraceMetricEventsResponseItem,
} from 'sentry/views/explore/metrics/types';
import {
  useQueryParamsSearch,
  useQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';
import {getEventView} from 'sentry/views/insights/common/queries/useDiscover';
import {getStaleTimeForEventView} from 'sentry/views/insights/common/queries/useSpansQuery';
import {INGESTION_DELAY} from 'sentry/views/insights/settings';

const MILLISECONDS_PER_SECOND = 1000;

interface UseMetricSamplesTableOptions {
  fields: string[];
  limit: number;
  disabled?: boolean;
  ingestionDelaySeconds?: number;
  queryExtras?: RPCQueryExtras;
  staleTime?: number;
  traceMetric?: TraceMetric;
}

interface MetricSamplesTableResult {
  result: {
    data: TraceMetricEventsResponseItem[] | undefined;
    isFetched: boolean;
    isFetching: boolean;
    meta?: EventsMetaType;
  };
  error?: Error;
  eventView?: EventView;
  isError?: boolean;
  isFetching?: boolean;
  isPending?: boolean;
  meta?: EventsMetaType;
}

function useMetricsQueryKey({
  limit,
  traceMetric,
  fields,
  ingestionDelaySeconds = INGESTION_DELAY,
  referrer,
  queryExtras,
}: {
  fields: string[];
  limit: number;
  referrer: string;
  ingestionDelaySeconds?: number;
  queryExtras?: RPCQueryExtras;
  traceMetric?: TraceMetric;
}) {
  const organization = useOrganization();
  const userSearch = useQueryParamsSearch();
  const frozenSearch = useMetricsFrozenSearch();
  const frozenTracePeriod = useMetricsFrozenTracePeriod();
  const sortBys = useQueryParamsSortBys();
  const {selection, isReady: pageFiltersReady} = usePageFilters();
  const location = useLocation();

  const fieldsToUse = useMemo(
    () => Array.from(new Set([...AlwaysPresentTraceMetricFields, ...fields])),
    [fields]
  );
  const queryString = useMemo(() => {
    const newSearch = userSearch.copy();

    if (frozenSearch) {
      newSearch.tokens.push(...frozenSearch.tokens);
    }

    if (traceMetric) {
      newSearch.addFilterValue(TraceMetricKnownFieldKey.METRIC_NAME, traceMetric.name);
      newSearch.addFilterValue(TraceMetricKnownFieldKey.METRIC_TYPE, traceMetric.type);
      if (traceMetric.unit && traceMetric.unit !== '-') {
        if (traceMetric.unit !== NONE_UNIT) {
          newSearch.addFilterValue(
            TraceMetricKnownFieldKey.METRIC_UNIT,
            traceMetric.unit
          );
        } else if (traceMetric.unit === NONE_UNIT) {
          newSearch.addOp('(');
          newSearch.addFilterValue('!has', TraceMetricKnownFieldKey.METRIC_UNIT);
          newSearch.addOp('OR');
          newSearch.addFilterValue(TraceMetricKnownFieldKey.METRIC_UNIT, NONE_UNIT);
          newSearch.addOp(')');
        }
      }
    }

    return newSearch.formatString();
  }, [userSearch, frozenSearch, traceMetric]);

  const baseDatetime = useMemo(() => {
    const datetime = frozenTracePeriod
      ? {
          start: frozenTracePeriod.start ?? null,
          end: frozenTracePeriod.end ?? null,
          period: frozenTracePeriod.period ?? null,
          utc: selection.datetime.utc,
        }
      : selection.datetime;

    return datetime;
  }, [selection.datetime, frozenTracePeriod]);

  const delayedRelativePeriod = useMemo(() => {
    const {end, period} = baseDatetime;
    const periodMs = period ? intervalToMilliseconds(period) : 0;

    if (period && periodMs > ingestionDelaySeconds * MILLISECONDS_PER_SECOND && !end) {
      return {
        statsPeriodStart: period,
        statsPeriodEnd: `${ingestionDelaySeconds}s`,
      };
    }

    return;
  }, [baseDatetime, ingestionDelaySeconds]);

  const pageFilters = {
    ...selection,
    datetime: baseDatetime,
  };
  const dataset = DiscoverDatasets.TRACEMETRICS;

  const eventView = getEventView(
    queryString,
    fieldsToUse,
    sortBys.slice(),
    pageFilters,
    dataset,
    pageFilters.projects
  );

  if (queryString) {
    eventView.query = queryString;
  }

  const eventViewPayload = eventView.getEventsAPIPayload(location);

  const orderby = sortBys.map(formatSort);

  const params = {
    query: {
      ...eventViewPayload,
      ...(delayedRelativePeriod
        ? {
            start: undefined,
            end: undefined,
            statsPeriod: undefined,
            statsPeriodStart: delayedRelativePeriod.statsPeriodStart,
            statsPeriodEnd: delayedRelativePeriod.statsPeriodEnd,
          }
        : {}),
      orderby: orderby.length > 0 ? orderby : undefined,
      per_page: limit,
      referrer,
      sampling: queryExtras?.samplingMode ?? SAMPLING_MODE.NORMAL,
      caseInsensitive: queryExtras?.caseInsensitive ? '1' : undefined,
      disableAggregateExtrapolation: queryExtras?.disableAggregateExtrapolation
        ? '1'
        : undefined,
    },
    pageFiltersReady,
    eventView,
  };

  const queryKey: ApiQueryKey = [
    getApiUrl('/organizations/$organizationIdOrSlug/events/', {
      path: {organizationIdOrSlug: organization.slug},
    }),
    params,
  ];

  return {
    queryKey,
    other: {
      eventView,
      pageFiltersReady,
    },
  };
}

export function useMetricSamplesTable({
  disabled,
  limit,
  traceMetric,
  fields,
  ingestionDelaySeconds,
  queryExtras,
  staleTime,
}: UseMetricSamplesTableOptions) {
  const canTriggerHighAccuracy = useCallback(
    (result: MetricSamplesTableResult['result']) => {
      const canGoToHigherAccuracyTier = result.meta?.dataScanned === 'partial';
      const hasData = defined(result.data) && result.data.length > 0;
      return !hasData && canGoToHigherAccuracyTier;
    },
    []
  );

  return useProgressiveQuery<typeof useMetricSamplesTableImpl>({
    queryHookImplementation: useMetricSamplesTableImpl,
    queryHookArgs: {
      enabled: !disabled,
      limit,
      traceMetric,
      fields,
      ingestionDelaySeconds,
      queryExtras,
      staleTime,
    },
    queryOptions: {
      canTriggerHighAccuracy,
    },
  });
}

function useMetricSamplesTableImpl({
  enabled,
  limit,
  traceMetric,
  fields,
  ingestionDelaySeconds = INGESTION_DELAY,
  queryExtras,
  staleTime,
}: UseMetricSamplesTableOptions & {enabled: boolean}): MetricSamplesTableResult {
  const {queryKey, other} = useMetricsQueryKey({
    limit,
    traceMetric,
    fields,
    ingestionDelaySeconds,
    referrer: 'api.explore.metric-samples-table',
    queryExtras,
  });

  const result = useApiQuery<{data: any[]; meta?: EventsMetaType}>(queryKey, {
    enabled,
    staleTime: staleTime ?? getStaleTimeForEventView(other.eventView),
  });

  return {
    error: result.error ?? undefined,
    isError: result.isError,
    isFetching: result.isFetching,
    isPending: result.isPending,
    meta: result.data?.meta,
    result: {
      data: result.data?.data,
      isFetched: result.isFetched,
      isFetching: result.isFetching,
      meta: result.data?.meta,
    },
    eventView: other?.eventView,
  };
}

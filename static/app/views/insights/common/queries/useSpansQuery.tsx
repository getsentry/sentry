import moment from 'moment-timezone';

import type {CaseInsensitive} from 'sentry/components/searchQueryBuilder/hooks';
import {defined} from 'sentry/utils';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import type EventView from 'sentry/utils/discover/eventView';
import type {EventsMetaType, MetaType} from 'sentry/utils/discover/eventView';
import {encodeSort} from 'sentry/utils/discover/eventView';
import type {DiscoverQueryProps} from 'sentry/utils/discover/genericDiscoverQuery';
import {useGenericDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {keepPreviousData as keepPreviousDataFn} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {
  RPCQueryExtras,
  SamplingMode,
} from 'sentry/views/explore/hooks/useProgressiveQuery';
import type {ExtrapolationMode} from 'sentry/views/insights/common/queries/types';
import {
  getRetryDelay,
  shouldRetryHandler,
} from 'sentry/views/insights/common/utils/retryHandlers';
import {TrackResponse} from 'sentry/views/insights/common/utils/trackResponse';

const DATE_FORMAT = 'YYYY-MM-DDTHH:mm:ssZ';

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const SIXTY_DAYS = 60 * 24 * 60 * 60 * 1000;

type SpansQueryProps<T = any[]> = {
  allowAggregateConditions?: boolean;
  cursor?: string;
  enabled?: boolean;
  eventView?: EventView;
  initialData?: T;
  limit?: number;
  queryExtras?: RPCQueryExtras;
  referrer?: string;
  trackResponseAnalytics?: boolean;
};

export function useSpansQuery<T = any[]>({
  referrer = 'use-spans-query',
  trackResponseAnalytics = true,
  ...props
}: SpansQueryProps<T>) {
  const {isReady: pageFiltersReady} = usePageFilters();
  return useSpansQueryBase({
    ...props,
    enabled: (props.enabled || props.enabled === undefined) && pageFiltersReady,
    referrer,
    trackResponseAnalytics,
    withPageFilters: true,
  });
}

export function useSpansQueryWithoutPageFilters<T = any[]>({
  referrer = 'use-spans-query',
  trackResponseAnalytics = true,
  ...props
}: SpansQueryProps<T>) {
  return useSpansQueryBase({
    ...props,
    enabled: props.enabled || props.enabled === undefined,
    referrer,
    trackResponseAnalytics,
    withPageFilters: false,
  });
}

function useSpansQueryBase<T>({
  eventView,
  initialData,
  limit,
  enabled,
  referrer,
  allowAggregateConditions,
  cursor,
  trackResponseAnalytics,
  queryExtras,
  withPageFilters,
}: SpansQueryProps<T> & {withPageFilters: boolean}) {
  if (!eventView) {
    throw new Error(
      'eventView argument must be defined when Starfish useDiscover is true'
    );
  }

  const isTimeseriesQuery = (eventView.yAxis?.length ?? 0) > 0;
  const queryFunction = isTimeseriesQuery
    ? withPageFilters
      ? useWrappedDiscoverTimeseriesQuery
      : useWrappedDiscoverTimeseriesQueryWithoutPageFilters
    : withPageFilters
      ? useWrappedDiscoverQuery
      : useWrappedDiscoverQueryWithoutPageFilters;

  const newEventView = eventView.clone();
  const response = queryFunction<T>({
    eventView: newEventView,
    initialData,
    limit,
    enabled,
    referrer,
    cursor,
    allowAggregateConditions,
    caseInsensitive: queryExtras?.caseInsensitive,
    samplingMode: queryExtras?.samplingMode,
    disableAggregateExtrapolation: queryExtras?.disableAggregateExtrapolation,
    logQuery: queryExtras?.logQuery,
    metricQuery: queryExtras?.metricQuery,
    spanQuery: queryExtras?.spanQuery,
  });

  if (trackResponseAnalytics) {
    TrackResponse(eventView, response);
  }

  return response;
}

type WrappedDiscoverTimeseriesQueryProps = {
  eventView: EventView;
  caseInsensitive?: CaseInsensitive;
  cursor?: string;
  enabled?: boolean;
  initialData?: any;
  logQuery?: string[];
  metricQuery?: string[];
  overriddenRoute?: string;
  referrer?: string;
  samplingMode?: SamplingMode;
  spanQuery?: string[];
};

function useWrappedDiscoverTimeseriesQueryBase<T>({
  eventView,
  enabled,
  initialData,
  referrer,
  cursor,
  overriddenRoute,
  samplingMode,
  caseInsensitive,
  logQuery,
  metricQuery,
  spanQuery,
}: WrappedDiscoverTimeseriesQueryProps) {
  const location = useLocation();
  const organization = useOrganization();

  const usesRelativeDateRange =
    !defined(eventView.start) &&
    !defined(eventView.end) &&
    defined(eventView.statsPeriod);

  const intervalInMilliseconds = eventView.interval
    ? intervalToMilliseconds(eventView.interval)
    : undefined;

  const result = useGenericDiscoverQuery<
    {
      data: any[];
      meta: MetaType;
    },
    DiscoverQueryProps
  >({
    route: overriddenRoute ?? 'events-stats',
    eventView,
    location,
    orgSlug: organization.slug,
    getRequestPayload: () => ({
      ...eventView.getEventsAPIPayload(location),
      yAxis: eventView.yAxis,
      topEvents: eventView.topEvents,
      excludeOther: 0,
      partial: 1,
      orderby: eventView.sorts?.[0] ? encodeSort(eventView.sorts?.[0]) : undefined,
      interval: eventView.interval,
      cursor,
      sampling:
        eventView.dataset === DiscoverDatasets.SPANS && samplingMode
          ? samplingMode
          : undefined,
      caseInsensitive,
      logQuery,
      metricQuery,
      spanQuery,
    }),
    options: {
      enabled,
      refetchOnWindowFocus: false,
      retry: shouldRetryHandler,
      retryDelay: getRetryDelay,
      staleTime:
        usesRelativeDateRange &&
        defined(intervalInMilliseconds) &&
        intervalInMilliseconds !== 0
          ? intervalInMilliseconds
          : Infinity,
    },
    referrer,
  });

  const isFetchingOrLoading = result.isPending || result.isFetching;
  const defaultData = initialData ?? undefined;

  const data: T = isFetchingOrLoading
    ? defaultData
    : processDiscoverTimeseriesResult(result.data, eventView);

  const pageLinks = result.response?.getResponseHeader('Link') ?? undefined;

  return {
    ...result,
    pageLinks,
    data,
    meta: result.data?.meta,
  };
}

function useWrappedDiscoverTimeseriesQuery<T>(
  props: WrappedDiscoverTimeseriesQueryProps
) {
  const {isReady} = usePageFilters();
  return useWrappedDiscoverTimeseriesQueryBase<T>({
    ...props,
    enabled: props.enabled && isReady,
  });
}

function useWrappedDiscoverTimeseriesQueryWithoutPageFilters<T>(
  props: WrappedDiscoverTimeseriesQueryProps
) {
  return useWrappedDiscoverTimeseriesQueryBase<T>(props);
}

type WrappedDiscoverQueryProps<T> = {
  eventView: EventView;
  additionalQueryKey?: string[];
  allowAggregateConditions?: boolean;
  caseInsensitive?: CaseInsensitive;
  cursor?: string;
  disableAggregateExtrapolation?: string;
  enabled?: boolean;
  extrapolationMode?: ExtrapolationMode;
  initialData?: T;
  keepPreviousData?: boolean;
  limit?: number;
  logQuery?: string[];
  metricQuery?: string[];
  noPagination?: boolean;
  referrer?: string;
  refetchInterval?: number;
  samplingMode?: SamplingMode;
  spanQuery?: string[];
};

function useWrappedDiscoverQueryBase<T>({
  eventView,
  initialData,
  enabled,
  keepPreviousData,
  referrer,
  limit,
  cursor,
  noPagination,
  allowAggregateConditions,
  disableAggregateExtrapolation,
  samplingMode,
  pageFiltersReady,
  additionalQueryKey,
  refetchInterval,
  caseInsensitive,
  logQuery,
  metricQuery,
  spanQuery,
  extrapolationMode,
}: WrappedDiscoverQueryProps<T> & {
  pageFiltersReady: boolean;
}) {
  const location = useLocation();
  const organization = useOrganization();

  const queryExtras: Record<string, string | string[]> = {};
  if (
    [DiscoverDatasets.SPANS, DiscoverDatasets.TRACEMETRICS].includes(
      eventView.dataset as DiscoverDatasets
    )
  ) {
    if (samplingMode) {
      queryExtras.sampling = samplingMode;
    }
    if (extrapolationMode) {
      queryExtras.extrapolationMode = extrapolationMode;
    }

    if (disableAggregateExtrapolation) {
      queryExtras.disableAggregateExtrapolation = '1';
    }
  }

  if (typeof caseInsensitive === 'boolean' && caseInsensitive) {
    queryExtras.caseInsensitive = '1';
  }

  if (Array.isArray(logQuery) && logQuery.length > 0) {
    queryExtras.logQuery = logQuery;
  }

  if (Array.isArray(metricQuery) && metricQuery.length > 0) {
    queryExtras.metricQuery = metricQuery;
  }

  if (Array.isArray(spanQuery) && spanQuery.length > 0) {
    queryExtras.spanQuery = spanQuery;
  }

  if (allowAggregateConditions !== undefined) {
    queryExtras.allowAggregateConditions = allowAggregateConditions ? '1' : '0';
  }

  const result = useDiscoverQuery({
    eventView,
    orgSlug: organization.slug,
    location,
    referrer,
    cursor,
    limit,
    options: {
      enabled: enabled && pageFiltersReady, // TODO this has a bug: if enabled is undefined, this short-circuits to undefined, which becomes true, regardless of pageFiltersReady
      refetchOnWindowFocus: false,
      retry: shouldRetryHandler,
      retryDelay: getRetryDelay,
      staleTime: getStaleTimeForEventView(eventView),
      additionalQueryKey,
      refetchInterval,
      placeholderData: keepPreviousData ? keepPreviousDataFn : undefined,
    },
    queryExtras,
    noPagination,
  });

  // TODO: useDiscoverQuery incorrectly states that it returns MetaType, but it
  // does not!
  const meta = result.data?.meta as EventsMetaType | undefined;

  const data =
    result.isPending && initialData ? initialData : (result.data?.data as T | undefined);

  return {
    ...result,
    data,
    meta,
  };
}

export function useWrappedDiscoverQuery<T>(props: WrappedDiscoverQueryProps<T>) {
  const {isReady: pageFiltersReady} = usePageFilters();
  return useWrappedDiscoverQueryBase({...props, pageFiltersReady});
}

export function useWrappedDiscoverQueryWithoutPageFilters<T>(
  props: WrappedDiscoverQueryProps<T>
) {
  return useWrappedDiscoverQueryBase({...props, pageFiltersReady: true});
}

type Interval = {interval: string; group?: string};

function processDiscoverTimeseriesResult(
  result: TableData | undefined,
  eventView: EventView
) {
  if (!result) {
    return undefined;
  }

  if (!eventView.yAxis) {
    return [];
  }

  const firstYAxis =
    typeof eventView.yAxis === 'string' ? eventView.yAxis : eventView.yAxis[0]!;

  if (result.data) {
    // Result data only returned one series. This means there was only only one yAxis requested, and no sub-series. Iterate the data, and return the result
    return processSingleDiscoverTimeseriesResult(result, firstYAxis).map(data => ({
      interval: moment(parseInt(data.interval, 10) * 1000).format(DATE_FORMAT),
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      [firstYAxis]: data[firstYAxis],
      group: data.group,
    }));
  }

  let intervals = [] as Interval[];

  // Result data had more than one series, grouped by a key. This means either multiple yAxes were requested _or_ a top-N query was set. Iterate the keys, and construct a series for each one.
  Object.keys(result).forEach(key => {
    // Each key has just one timeseries. Either this is a simple multi-axis query, or a top-N query with just one axis
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    if (result[key].data) {
      intervals = mergeIntervals(
        intervals,
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        processSingleDiscoverTimeseriesResult(result[key], key)
      );
    } else {
      // Each key has more than one timeseries. This is a multi-axis top-N query. Iterate each series, but this time set both the key _and_ the group
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      Object.keys(result[key]).forEach(innerKey => {
        if (innerKey !== 'order') {
          // `order` is a special value, each series has it in a multi-series query
          intervals = mergeIntervals(
            intervals,
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            processSingleDiscoverTimeseriesResult(result[key][innerKey], innerKey, key)
          );
        }
      });
    }
  });

  const processed = intervals.map(interval => ({
    ...interval,
    interval: moment(parseInt(interval.interval, 10) * 1000).format(DATE_FORMAT),
  }));

  return processed;
}

function processSingleDiscoverTimeseriesResult(result: any, key: string, group?: string) {
  const intervals = [] as Interval[];

  // @ts-expect-error TS(7031): Binding element 'timestamp' implicitly has an 'any... Remove this comment to see the full error message
  result.data.forEach(([timestamp, [{count: value}]]) => {
    const existingInterval = intervals.find(
      interval =>
        interval.interval === timestamp && (group ? interval.group === group : true)
    );

    if (existingInterval) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      existingInterval[key] = value;
      return;
    }

    intervals.push({
      interval: timestamp,
      [key]: value,
      group,
    });
  });

  return intervals;
}

function mergeIntervals(first: Interval[], second: Interval[]) {
  const target: Interval[] = JSON.parse(JSON.stringify(first));

  second.forEach(({interval: timestamp, group, ...rest}) => {
    const existingInterval = target.find(
      interval =>
        interval.interval === timestamp && (group ? interval.group === group : true)
    );

    if (existingInterval) {
      Object.keys(rest).forEach(key => {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        existingInterval[key] = rest[key];
      });

      return;
    }

    target.push({interval: timestamp, group, ...rest});
  });
  return target;
}

function getStaleTimeForRelativePeriodTable(statsPeriod: string | undefined) {
  if (!defined(statsPeriod)) {
    return Infinity;
  }
  const periodInMs = intervalToMilliseconds(statsPeriod);

  if (periodInMs <= SEVEN_DAYS) {
    return 0;
  }

  if (periodInMs <= FOURTEEN_DAYS) {
    return 10 * 1000;
  }

  if (periodInMs <= THIRTY_DAYS) {
    return 30 * 1000;
  }

  if (periodInMs <= SIXTY_DAYS) {
    return 60 * 1000;
  }

  return 5 * 60 * 1000;
}

export function getStaleTimeForEventView(eventView: EventView) {
  const usesRelativeDateRange =
    !defined(eventView.start) &&
    !defined(eventView.end) &&
    defined(eventView.statsPeriod);
  if (usesRelativeDateRange) {
    return getStaleTimeForRelativePeriodTable(eventView.statsPeriod);
  }
  return Infinity;
}

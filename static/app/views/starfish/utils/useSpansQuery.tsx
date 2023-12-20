import moment from 'moment';

import {TableData, useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView, {
  encodeSort,
  EventsMetaType,
  MetaType,
} from 'sentry/utils/discover/eventView';
import {
  DiscoverQueryProps,
  useGenericDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  getRetryDelay,
  shouldRetryHandler,
} from 'sentry/views/starfish/utils/retryHandlers';
import {TrackResponse} from 'sentry/views/starfish/utils/trackResponse';

export const DATE_FORMAT = 'YYYY-MM-DDTHH:mm:ssZ';

export function useSpansQuery<T = any[]>({
  eventView,
  initialData,
  limit,
  enabled,
  referrer = 'use-spans-query',
  cursor,
}: {
  cursor?: string;
  enabled?: boolean;
  eventView?: EventView;
  initialData?: T;
  limit?: number;
  referrer?: string;
}) {
  const isTimeseriesQuery = (eventView?.yAxis?.length ?? 0) > 0;
  const queryFunction = isTimeseriesQuery
    ? useWrappedDiscoverTimeseriesQuery
    : useWrappedDiscoverQuery;

  const {isReady: pageFiltersReady} = usePageFilters();

  if (eventView) {
    const newEventView = eventView.clone();
    const response = queryFunction<T>({
      eventView: newEventView,
      initialData,
      limit,
      // We always want to wait until the pageFilters are ready to prevent clobbering requests
      enabled: (enabled || enabled === undefined) && pageFiltersReady,
      referrer,
      cursor,
    });

    TrackResponse(eventView, response);

    return response;
  }

  throw new Error('eventView argument must be defined when Starfish useDiscover is true');
}

function useWrappedDiscoverTimeseriesQuery<T>({
  eventView,
  enabled,
  initialData,
  referrer,
  cursor,
}: {
  eventView: EventView;
  cursor?: string;
  enabled?: boolean;
  initialData?: any;
  referrer?: string;
}) {
  const location = useLocation();
  const organization = useOrganization();
  const {isReady: pageFiltersReady} = usePageFilters();
  const result = useGenericDiscoverQuery<
    {
      data: any[];
      meta: MetaType;
    },
    DiscoverQueryProps
  >({
    route: 'events-stats',
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
    }),
    options: {
      enabled: enabled && pageFiltersReady,
      refetchOnWindowFocus: false,
      retry: shouldRetryHandler,
      retryDelay: getRetryDelay,
      staleTime: Infinity,
    },
    referrer,
  });

  const isFetchingOrLoading = result.isLoading || result.isFetching;
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

export function useWrappedDiscoverQuery<T>({
  eventView,
  initialData,
  enabled,
  referrer,
  limit,
  cursor,
}: {
  eventView: EventView;
  cursor?: string;
  enabled?: boolean;
  initialData?: T;
  limit?: number;
  referrer?: string;
}) {
  const location = useLocation();
  const organization = useOrganization();
  const {isReady: pageFiltersReady} = usePageFilters();
  const result = useDiscoverQuery({
    eventView,
    orgSlug: organization.slug,
    location,
    referrer,
    cursor,
    limit,
    options: {
      enabled: enabled && pageFiltersReady,
      refetchOnWindowFocus: false,
      retry: shouldRetryHandler,
      retryDelay: getRetryDelay,
      staleTime: Infinity,
    },
  });

  // TODO: useDiscoverQuery incorrectly states that it returns MetaType, but it
  // does not!
  const meta = result.data?.meta as EventsMetaType | undefined;

  const data =
    result.isLoading && initialData ? initialData : (result.data?.data as T | undefined);

  return {
    ...result,
    data,
    meta,
  };
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
  let intervals = [] as Interval[];
  const singleYAxis =
    eventView.yAxis &&
    (typeof eventView.yAxis === 'string' || eventView.yAxis.length === 1);
  const firstYAxis =
    typeof eventView.yAxis === 'string' ? eventView.yAxis : eventView.yAxis[0];
  if (result.data) {
    const timeSeriesResult: Interval[] = processSingleDiscoverTimeseriesResult(
      result,
      singleYAxis ? firstYAxis : 'count'
    ).map(data => ({
      interval: moment(parseInt(data.interval, 10) * 1000).format(DATE_FORMAT),
      [firstYAxis]: data[firstYAxis],
      group: data.group,
    }));
    return timeSeriesResult;
  }
  Object.keys(result).forEach(key => {
    if (result[key].data) {
      intervals = mergeIntervals(
        intervals,
        processSingleDiscoverTimeseriesResult(result[key], singleYAxis ? firstYAxis : key)
      );
    } else {
      Object.keys(result[key]).forEach(innerKey => {
        if (innerKey !== 'order') {
          intervals = mergeIntervals(
            intervals,
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

function processSingleDiscoverTimeseriesResult(result, key: string, group?: string) {
  const intervals = [] as Interval[];
  result.data.forEach(([timestamp, [{count: value}]]) => {
    const existingInterval = intervals.find(
      interval =>
        interval.interval === timestamp && (group ? interval.group === group : true)
    );
    if (existingInterval) {
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
        existingInterval[key] = rest[key];
      });
      return;
    }
    target.push({interval: timestamp, group, ...rest});
  });
  return target;
}

import moment from 'moment';

import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
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
  initialData?: any;
  limit?: number;
  referrer?: string;
}) {
  const isTimeseriesQuery = (eventView?.yAxis?.length ?? 0) > 0;
  const queryFunction = isTimeseriesQuery
    ? useWrappedDiscoverTimeseriesQuery
    : useWrappedDiscoverQuery;

  if (eventView) {
    const response = queryFunction<T>({
      eventView,
      initialData,
      limit,
      enabled,
      referrer,
      cursor,
    });

    TrackResponse(eventView, response);

    return response;
  }

  throw new Error('eventView argument must be defined when Starfish useDiscover is true');
}

export function useWrappedDiscoverTimeseriesQuery<T>({
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
      enabled,
      refetchOnWindowFocus: false,
    },
    referrer,
  });

  const data: T =
    result.isLoading && initialData
      ? initialData
      : processDiscoverTimeseriesResult(result.data, eventView);

  return {
    ...result,
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
  initialData?: any;
  limit?: number;
  referrer?: string;
}) {
  const location = useLocation();
  const organization = useOrganization();
  const result = useDiscoverQuery({
    eventView,
    orgSlug: organization.slug,
    location,
    referrer,
    cursor,
    limit,
    options: {
      enabled,
      refetchOnWindowFocus: false,
    },
  });

  const meta = result.data?.meta as EventsMetaType | undefined;
  if (meta) {
    // TODO: Remove this hack when the backend returns `"rate"` as the data
    // type for `sps()` and other rate fields!
    meta.fields['sps()'] = 'rate';
    meta.units['sps()'] = '1/second';
  }

  const data: T = result.isLoading && initialData ? initialData : result.data?.data;

  return {
    ...result,
    data,
    meta, // TODO: useDiscoverQuery incorrectly states that it returns MetaType, but it does not!
  };
}

type Interval = {[key: string]: any; interval: string; group?: string};

function processDiscoverTimeseriesResult(result, eventView: EventView) {
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

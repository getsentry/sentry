import {useQuery} from '@tanstack/react-query';
import moment from 'moment';

import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView, {encodeSort} from 'sentry/utils/discover/eventView';
import {
  DiscoverQueryProps,
  useGenericDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {useStarfishOptions} from 'sentry/views/starfish/utils/useStarfishOptions';

const DATE_FORMAT = 'YYYY-MM-DDTHH:mm:ss';

// Setting return type since I'd rather not know if its discover query or not
export type UseSpansQueryReturnType<T> = {data: T; isLoading: boolean};

export function useSpansQuery<T = any[]>({
  eventView,
  queryString,
  initialData,
  forceUseDiscover,
  enabled,
}: {
  enabled?: boolean;
  eventView?: EventView;
  forceUseDiscover?: boolean;
  initialData?: any;
  queryString?: string;
}): UseSpansQueryReturnType<T> {
  const {options} = useStarfishOptions();
  const {useDiscover} = options;
  const queryFunction = getQueryFunction({
    useDiscover: forceUseDiscover ?? useDiscover,
    isTimeseriesQuery: (eventView?.yAxis?.length ?? 0) > 0,
  });
  if (isDiscoverFunction(queryFunction) || isDiscoverTimeseriesFunction(queryFunction)) {
    if (eventView) {
      return queryFunction({eventView, initialData, enabled});
    }
    throw new Error(
      'eventView argument must be defined when Starfish useDiscover is true'
    );
  }

  if (queryString) {
    return queryFunction({queryString, initialData, enabled});
  }
  throw new Error(
    'queryString argument must be defined when Starfish useDiscover is false, ie when using scraped data via fetch API'
  );
}

function isDiscoverFunction(
  queryFunction: Function
): queryFunction is typeof useWrappedDiscoverQuery {
  return queryFunction === useWrappedDiscoverQuery;
}

function isDiscoverTimeseriesFunction(
  queryFunction: Function
): queryFunction is typeof useWrappedDiscoverTimeseriesQuery {
  return queryFunction === useWrappedDiscoverTimeseriesQuery;
}

export function useWrappedQuery({
  queryString,
  initialData,
  enabled,
}: {
  queryString: string;
  enabled?: boolean;
  initialData?: any;
}) {
  const {isLoading, data} = useQuery({
    queryKey: [queryString],
    queryFn: () => fetch(`${HOST}/?query=${queryString}`).then(res => res.json()),
    retry: false,
    initialData,
    enabled,
    refetchOnWindowFocus: false,
  });
  return {isLoading, data};
}

export function useWrappedDiscoverTimeseriesQuery({
  eventView,
  enabled,
  initialData,
}: {
  eventView: EventView;
  enabled?: boolean;
  initialData?: any;
}) {
  const location = useLocation();
  const organization = useOrganization();
  const {isLoading, data} = useGenericDiscoverQuery<
    {
      data: any[];
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
      excludeOther: 1,
      partial: 1,
      orderby: eventView.sorts?.[0] ? encodeSort(eventView.sorts?.[0]) : undefined,
      interval: eventView.interval,
    }),
    options: {
      enabled,
      refetchOnWindowFocus: false,
    },
  });
  return {
    isLoading,
    data:
      isLoading && initialData
        ? initialData
        : processDiscoverTimeseriesResult(data, eventView),
  };
}

export function useWrappedDiscoverQuery({
  eventView,
  initialData,
}: {
  eventView: EventView;
  initialData?: any;
}) {
  const location = useLocation();
  const organization = useOrganization();
  const {isLoading, data} = useDiscoverQuery({
    eventView,
    orgSlug: organization.slug,
    location,
  });
  return {isLoading, data: isLoading && initialData ? initialData : data?.data};
}

function getQueryFunction({
  useDiscover,
  isTimeseriesQuery,
}: {
  useDiscover: boolean;
  isTimeseriesQuery?: boolean;
}) {
  if (useDiscover) {
    if (isTimeseriesQuery) {
      return useWrappedDiscoverTimeseriesQuery;
    }
    return useWrappedDiscoverQuery;
  }
  return useWrappedQuery;
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
    return processSingleDiscoverTimeseriesResult(
      result,
      singleYAxis ? firstYAxis : 'count'
    );
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

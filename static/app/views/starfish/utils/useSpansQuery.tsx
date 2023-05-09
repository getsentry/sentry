import {useQuery} from '@tanstack/react-query';
import moment from 'moment';

import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
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
type ReturnType = {data: any; isLoading: boolean};

export function useSpansQuery({
  eventView,
  queryString,
  initialData,
}: {
  eventView?: EventView;
  initialData?: any;
  queryString?: string;
}): ReturnType {
  const {options} = useStarfishOptions();
  const {useDiscover} = options;
  const queryFunction = getQueryFunction({
    useDiscover,
    isTimeseriesQuery: (eventView?.yAxis?.length ?? 0) > 0,
  });
  if (isDiscoverFunction(queryFunction) || isDiscoverTimeseriesFunction(queryFunction)) {
    if (eventView) {
      return queryFunction(eventView, initialData);
    }
    throw new Error(
      'eventView argument must be defined when Starfish useDiscover is true'
    );
  }

  if (queryString) {
    return queryFunction(queryString, initialData);
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

function useWrappedQuery(queryString: string, initialData?: any) {
  const {isLoading, data} = useQuery({
    queryKey: [queryString],
    queryFn: () => fetch(`${HOST}/?query=${queryString}`).then(res => res.json()),
    retry: false,
    initialData,
  });
  return {isLoading, data};
}

function useWrappedDiscoverTimeseriesQuery(eventView: EventView, initialData?: any) {
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
      yAxis: Array.from(
        new Set([eventView.yAxis, ...eventView.fields.map(f => f.field)])
      ),
    }),
  });
  return {
    isLoading,
    data:
      isLoading && initialData
        ? initialData
        : processDiscoverTimeseriesResult(data, eventView),
  };
}

function useWrappedDiscoverQuery(eventView: EventView, initialData?: any) {
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

function processDiscoverTimeseriesResult(result, eventView: EventView) {
  const intervals = {};
  if (result.data) {
    result.data.forEach(([timestamp, [{count: value}]]) => {
      intervals[timestamp] = {
        ...(intervals[timestamp] ?? {}),
        [eventView.yAxis ?? eventView.fields[0].field]: value,
      };
    });
  } else {
    Object.keys(result).forEach(key => {
      result[key].data.forEach(([timestamp, [{count: value}]]) => {
        intervals[timestamp] = {...(intervals[timestamp] ?? {}), [key]: value};
      });
    });
  }
  const processed = Object.keys(intervals).map(key => ({
    interval: moment(parseInt(key, 10) * 1000).format(DATE_FORMAT),
    ...intervals[key],
  }));
  return processed;
}

import {EventsStats, MultiSeriesEventsStats} from 'sentry/types';
import EventView, {encodeSort} from 'sentry/utils/discover/eventView';
import {
  DiscoverQueryProps,
  useGenericDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  getRetryDelay,
  shouldRetryHandler,
} from 'sentry/views/starfish/utils/retryHandlers';

export function useEventsStatsQuery({
  eventView,
  enabled,
  initialData,
  referrer,
}: {
  eventView: EventView;
  enabled?: boolean;
  initialData?: any;
  referrer?: string;
}) {
  const location = useLocation();
  const organization = useOrganization();
  const {isLoading, data, isError} = useGenericDiscoverQuery<
    EventsStats | MultiSeriesEventsStats,
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
    }),
    options: {
      enabled,
      refetchOnWindowFocus: false,
      retry: shouldRetryHandler,
      retryDelay: getRetryDelay,
      staleTime: Infinity,
    },
    referrer,
  });
  return {
    isLoading,
    data: isLoading && initialData ? initialData : data,
    isError,
  };
}

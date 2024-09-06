import type {MultiSeriesEventsStats} from 'sentry/types/organization';
import type EventView from 'sentry/utils/discover/eventView';
import {encodeSort} from 'sentry/utils/discover/eventView';
import type {DiscoverQueryProps} from 'sentry/utils/discover/genericDiscoverQuery';
import {useGenericDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  getRetryDelay,
  shouldRetryHandler,
} from 'sentry/views/insights/common/utils/retryHandlers';

export function useEventsStatsQuery({
  eventView,
  enabled,
  referrer,
  initialData,
  excludeOther = false,
}: {
  eventView: EventView;
  enabled?: boolean;
  excludeOther?: boolean;
  initialData?: MultiSeriesEventsStats;
  referrer?: string;
}) {
  const location = useLocation();
  const organization = useOrganization();
  const result = useGenericDiscoverQuery<MultiSeriesEventsStats, DiscoverQueryProps>({
    route: 'events-stats',
    eventView,
    location,
    orgSlug: organization.slug,
    getRequestPayload: () => ({
      ...eventView.getEventsAPIPayload(location),
      yAxis: eventView.yAxis,
      topEvents: eventView.topEvents,
      excludeOther: excludeOther === true ? 1 : 0,
      partial: 1,
      orderby: eventView.sorts?.[0] ? encodeSort(eventView.sorts?.[0]) : undefined,
      interval: eventView.interval,
    }),
    options: {
      enabled,
      refetchOnWindowFocus: false,
      retry: shouldRetryHandler,
      retryDelay: getRetryDelay,
    },
    referrer,
  });

  return {...result, data: result.isPending ? initialData : result.data};
}

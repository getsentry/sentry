import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {Event, EventsStatsData} from 'sentry/types';
import EventView, {MetaType} from 'sentry/utils/discover/eventView';
import {
  DiscoverQueryProps,
  useGenericDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  NormalizedTrendsTransaction,
  TrendFunctionField,
} from 'sentry/views/performance/trends/types';
import {generateTrendFunctionAsString} from 'sentry/views/performance/trends/utils';

import {DataSection} from '../styles';

import Chart from './lineChart';

function camelToUnderscore(key: string) {
  return key.replace(/([A-Z\d])/g, '_$1').toLowerCase();
}

type EventBreakpointChartProps = {
  event: Event;
};

function EventBreakpointChart({event}: EventBreakpointChartProps) {
  const organization = useOrganization();
  const location = useLocation();

  const {transaction, requestStart, requestEnd} = event?.occurrence?.evidenceData ?? {};

  const eventView = EventView.fromLocation(location);
  eventView.query = `event.type:transaction transaction:"${transaction}"`;
  eventView.start = new Date(requestStart * 1000).toISOString();
  eventView.end = new Date(requestEnd * 1000).toISOString();
  eventView.dataset = DiscoverDatasets.METRICS;

  // If start and end were defined, then do not use default 14d stats period
  eventView.statsPeriod = requestStart && requestEnd ? '' : eventView.statsPeriod;

  // The evidence data keys are returned to us in camelCase, but we need to
  // convert them to snake_case to match the NormalizedTrendsTransaction type
  const normalizedOccurrenceEvent = Object.keys(
    event?.occurrence?.evidenceData ?? []
  ).reduce((acc, key) => {
    acc[camelToUnderscore(key)] = event?.occurrence?.evidenceData?.[key];
    return acc;
  }, {}) as NormalizedTrendsTransaction;

  const {data, isLoading} = useGenericDiscoverQuery<
    {
      data: EventsStatsData;
      meta: MetaType;
    },
    DiscoverQueryProps
  >({
    route: 'events-stats',
    location,
    eventView,
    orgSlug: organization.slug,
    getRequestPayload: () => ({
      // Manually inject y-axis for events-stats because
      // getEventsAPIPayload doesn't pass it along
      ...eventView.getEventsAPIPayload(location),
      yAxis: 'p95(transaction.duration)',
    }),
  });

  return (
    <DataSection>
      <TransitionChart loading={isLoading} reloading>
        <TransparentLoadingMask visible={isLoading} />
        <Chart
          statsData={data?.data ?? []}
          evidenceData={normalizedOccurrenceEvent}
          start={eventView.start}
          end={eventView.end}
          chartLabel={generateTrendFunctionAsString(
            TrendFunctionField.P95,
            'transaction.duration'
          )}
        />
      </TransitionChart>
    </DataSection>
  );
}

export default EventBreakpointChart;

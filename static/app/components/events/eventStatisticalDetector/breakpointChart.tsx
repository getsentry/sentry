import {useMemo} from 'react';

import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {Event, EventsStatsData} from 'sentry/types';
import EventView, {MetaType} from 'sentry/utils/discover/eventView';
import {
  DiscoverQueryProps,
  useGenericDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useRelativeDateTime} from 'sentry/utils/profiling/hooks/useRelativeDateTime';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {transformEventStats} from 'sentry/views/performance/trends/chart';
import {
  NormalizedTrendsTransaction,
  TrendFunctionField,
} from 'sentry/views/performance/trends/types';
import {generateTrendFunctionAsString} from 'sentry/views/performance/trends/utils';

import {DataSection} from '../styles';

import {RELATIVE_DAYS_WINDOW} from './consts';
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

  const {transaction, breakpoint} = event?.occurrence?.evidenceData ?? {};

  const eventView = EventView.fromLocation(location);
  eventView.query = `event.type:transaction transaction:"${transaction}"`;
  eventView.dataset = DiscoverDatasets.METRICS;

  const datetime = useRelativeDateTime({
    anchor: breakpoint,
    relativeDays: RELATIVE_DAYS_WINDOW,
  });
  const {start: beforeDateTime, end: afterDateTime} = datetime;

  eventView.start = (beforeDateTime as Date).toISOString();
  eventView.end = (afterDateTime as Date).toISOString();
  eventView.statsPeriod = undefined;

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
      yAxis: ['p95(transaction.duration)', 'count()'],
    }),
  });

  const p95Series = useMemo(
    () =>
      transformEventStats(
        data?.['p95(transaction.duration)']?.data ?? [],
        generateTrendFunctionAsString(TrendFunctionField.P95, 'transaction.duration')
      ),
    [data]
  );

  return (
    <DataSection>
      <TransitionChart loading={isLoading} reloading>
        <TransparentLoadingMask visible={isLoading} />
        <Chart
          percentileSeries={p95Series}
          evidenceData={normalizedOccurrenceEvent}
          datetime={datetime}
        />
      </TransitionChart>
    </DataSection>
  );
}

export default EventBreakpointChart;

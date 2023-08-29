import {Event} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import TrendsDiscoverQuery from 'sentry/utils/performance/trends/trendsDiscoverQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {TrendsChart} from 'sentry/views/performance/landing/widgets/widgets/trendsWidget';
import {
  NormalizedTrendsTransaction,
  TrendChangeType,
  TrendFunctionField,
} from 'sentry/views/performance/trends/types';

import {DataSection} from '../styles';

type EventBreakpointChartProps = {
  event: Event;
};

function camelToUnderscore(key) {
  return key.replace(/([A-Z\d])/g, '_$1').toLowerCase();
}

function EventBreakpointChart({event}: EventBreakpointChartProps) {
  const organization = useOrganization();
  const location = useLocation();

  console.log(event);
  const eventView = EventView.fromLocation(location);
  eventView.query = `event.type:transaction transaction:${event.title}`;
  eventView.fields = [
    {field: 'p95(transaction.duration)'},
    {field: 'transaction'},
    {field: 'project'},
  ];

  // Set the start and end time to 7 days before and after the breakpoint
  // TODO: This should be removed when the endpoint begins returning the start and end
  // explicitly
  if (event?.occurrence) {
    eventView.statsPeriod = undefined;
    const detectionTime = new Date(event?.occurrence?.evidenceData?.breakpoint);
    const start = new Date(detectionTime).setDate(detectionTime.getDate() - 7);
    const end = new Date(detectionTime).setDate(detectionTime.getDate() + 7);

    eventView.start = new Date(start).toISOString();
    eventView.end = new Date(Math.min(end, Date.now())).toISOString();
  } else {
    eventView.statsPeriod = '14d';
  }

  const normalizedOccurrenceEvent = Object.keys(
    event?.occurrence?.evidenceData ?? []
  ).reduce((acc, key) => {
    acc[camelToUnderscore(key)] = event?.occurrence?.evidenceData?.[key];
    return acc;
  }, {}) as NormalizedTrendsTransaction;

  return (
    <DataSection>
      <TrendsDiscoverQuery
        orgSlug={organization.slug}
        eventView={eventView}
        location={location}
        trendChangeType={TrendChangeType.REGRESSION}
        trendFunctionField={TrendFunctionField.P95}
        limit={5}
        cursor="0:0:1"
        noPagination
        withBreakpoint
      >
        {({trendsData, isLoading}) => {
          console.log(trendsData);
          return (
            <TrendsChart
              organization={organization}
              isLoading={isLoading}
              statsData={trendsData?.stats ?? {}}
              query={eventView.query}
              project={eventView.project}
              environment={eventView.environment}
              start={eventView.start}
              end={eventView.end}
              statsPeriod={eventView.statsPeriod}
              transaction={normalizedOccurrenceEvent}
              trendChangeType={TrendChangeType.REGRESSION}
              trendFunctionField={TrendFunctionField.P95}
              disableXAxis
              disableLegend
            />
          );
        }}
      </TrendsDiscoverQuery>
    </DataSection>
  );
}

export default EventBreakpointChart;

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

function camelToUnderscore(key: string) {
  return key.replace(/([A-Z\d])/g, '_$1').toLowerCase();
}

type EventBreakpointChartProps = {
  event: Event;
};

function EventBreakpointChart({event}: EventBreakpointChartProps) {
  const organization = useOrganization();
  const location = useLocation();

  const eventView = EventView.fromLocation(location);
  eventView.query = `event.type:transaction transaction:"${event?.occurrence?.evidenceData?.transaction}"`;
  eventView.fields = [{field: 'transaction'}, {field: 'project'}];

  // Set the start and end time to 7 days before and after the breakpoint
  // TODO: This should be removed when the endpoint begins returning the start and end
  // explicitly
  if (event?.occurrence) {
    eventView.statsPeriod = undefined;
    const detectionTime = new Date(event?.occurrence?.evidenceData?.breakpoint * 1000);
    const start = new Date(detectionTime).setDate(detectionTime.getDate() - 7);
    const end = new Date(detectionTime).setDate(detectionTime.getDate() + 7);

    eventView.start = new Date(start).toISOString();
    eventView.end = new Date(Math.min(end, Date.now())).toISOString();
  } else {
    eventView.statsPeriod = '14d';
  }

  // The evidence data keys are returned to us in camelCase, but we need to
  // convert them to snake_case to match the NormalizedTrendsTransaction type
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
        limit={1}
        queryExtras={{
          withTimeseries: 'true',
          interval: '1h',
        }}
        withBreakpoint
      >
        {({trendsData, isLoading}) => {
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
              disableLegend
            />
          );
        }}
      </TrendsDiscoverQuery>
    </DataSection>
  );
}

export default EventBreakpointChart;

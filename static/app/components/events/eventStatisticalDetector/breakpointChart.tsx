import {LineSeriesOption} from 'echarts';

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

  const {transaction, requestStart, requestEnd} = event?.occurrence?.evidenceData ?? {};

  const eventView = EventView.fromLocation(location);
  eventView.query = `event.type:transaction transaction:"${transaction}"`;
  eventView.fields = [{field: 'transaction'}, {field: 'project'}];
  eventView.start = new Date(requestStart * 1000).toISOString();
  eventView.end = new Date(requestEnd * 1000).toISOString();

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

  const additionalSeries: LineSeriesOption[] = [];

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
              additionalSeries={additionalSeries}
              applyRegressionFormatToInterval
              disableLegend
            />
          );
        }}
      </TrendsDiscoverQuery>
    </DataSection>
  );
}

export default EventBreakpointChart;

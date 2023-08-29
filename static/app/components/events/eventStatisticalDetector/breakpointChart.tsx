import {useEffect} from 'react';

import {Event} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import TrendsDiscoverQuery from 'sentry/utils/performance/trends/trendsDiscoverQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
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
  const router = useRouter();

  useEffect(() => {
    // TODO: This is a hack to get the trends function to use the p95 transaction duration
    // It's currently pulled from the location on 144 in trendChart/index.tsx
    // and read out in 54 of trendsDiscoverQuery.tsx
    router.push({
      ...location,
      query: {
        ...location.query,
        trendFunction: 'p95',
        trendParameter: 'transaction.duration',

        // Also need to unselect series by default, maybe? Looks kind of noisy.
        unselectedSeries: 'Releases',
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eventView = EventView.fromLocation(location);
  eventView.statsPeriod = '14d';
  eventView.query = `event.type:transaction transaction:${event?.occurrence?.evidenceData?.transaction}`;
  eventView.fields = [
    {field: 'p95(transaction.duration)'},
    {field: 'transaction'},
    {field: 'project'},
  ];
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
        noPagination
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

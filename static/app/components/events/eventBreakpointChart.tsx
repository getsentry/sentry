import {useEffect} from 'react';

import EventView from 'sentry/utils/discover/eventView';
// import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import TrendsDiscoverQuery from 'sentry/utils/performance/trends/trendsDiscoverQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {TrendsChart} from 'sentry/views/performance/landing/widgets/widgets/trendsWidget';
// import {generateEventView} from 'sentry/views/performance/transactionSummary/transactionOverview';
// import TrendChart from 'sentry/views/performance/transactionSummary/transactionOverview/trendChart';
import {
  TrendChangeType,
  TrendFunctionField,
  TrendsStats,
} from 'sentry/views/performance/trends/types';

import {DataSection} from './styles';

function EventBreakpointChart({event}) {
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

  // const eventView = generateEventView({
  //   location,
  //   transactionName: 'sentry.tasks.store.process_event',
  //   organization,
  // });
  const eventView = EventView.fromLocation(location);
  eventView.statsPeriod = '14d';
  eventView.query = `event.type:transaction transaction:${event?.occurrence?.evidenceData?.transaction}`;
  eventView.fields = [
    {field: 'p95(transaction.duration)'},
    {field: 'transaction'},
    {field: 'project'},
  ];
  console.log(eventView);
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
        {({trendsData, isLoading, ...rest}) => {
          // debugger;
          console.log(trendsData, rest);
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
              transaction={event?.occurrence?.evidenceData?.transaction}
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

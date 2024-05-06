import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import SearchBar from 'sentry/components/performance/searchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {NewQuery} from 'sentry/types';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {escapeFilterValue, MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {prepareQueryForLandingPage} from 'sentry/views/performance/data';
import {TOP_SCREENS} from 'sentry/views/performance/mobile/constants';
import {
  getFreeTextFromQuery,
  YAxis,
  YAXIS_COLUMNS,
} from 'sentry/views/performance/mobile/screenload/screens';
import {useTableQuery} from 'sentry/views/performance/mobile/screenload/screens/screensTable';
import {transformReleaseEvents} from 'sentry/views/performance/mobile/screenload/screens/utils';
import {Referrer} from 'sentry/views/performance/mobile/ui/referrers';
import {UIScreensTable} from 'sentry/views/performance/mobile/ui/screens/table';
import {TopScreensChart} from 'sentry/views/performance/mobile/ui/screens/topScreensChart';
import {getTransactionSearchQuery} from 'sentry/views/performance/utils';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';

const Y_AXES = [YAxis.SLOW_FRAMES, YAxis.FROZEN_FRAMES, YAxis.FRAMES_DELAY];
const Y_AXIS_COLUMNS = [
  'avg(mobile.slow_frames)',
  'avg(mobile.frozen_frames)',
  'avg(mobile.frames_delay)',
];

export function UIScreens() {
  const theme = useTheme();
  const router = useRouter();
  const {selection} = usePageFilters();
  const location = useLocation();
  const organization = useOrganization();
  const {query: locationQuery} = location;

  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();

  // TODO: Add transaction.op:ui.load when collecting begins
  const query = new MutableSearch([]);

  const searchQuery = decodeScalar(locationQuery.query, '');
  if (searchQuery) {
    query.addStringFilter(prepareQueryForLandingPage(searchQuery, false));
  }

  const queryString = appendReleaseFilters(query, primaryRelease, secondaryRelease);

  // TODO: Replace with a default sort on the count column when added
  const orderby = decodeScalar(locationQuery.sort, '');
  const newQuery: NewQuery = {
    name: '',
    fields: [
      SpanMetricsField.PROJECT_ID,
      'transaction',
      `avg_if(mobile.slow_frames,release,${primaryRelease})`,
      `avg_if(mobile.slow_frames,release,${secondaryRelease})`,
      `avg_if(mobile.frozen_frames,release,${primaryRelease})`,
      `avg_if(mobile.frozen_frames,release,${secondaryRelease})`,
      `avg_if(mobile.frames_delay,release,${primaryRelease})`,
      `avg_if(mobile.frames_delay,release,${secondaryRelease})`,
      `avg_compare(mobile.slow_frames,release,${primaryRelease},${secondaryRelease})`,
      `avg_compare(mobile.frozen_frames,release,${primaryRelease},${secondaryRelease})`,
      `avg_compare(mobile.frames_delay,release,${primaryRelease},${secondaryRelease})`,
    ],
    query: queryString,
    dataset: DiscoverDatasets.SPANS_METRICS,
    version: 2,
    projects: selection.projects,
  };
  newQuery.orderby = orderby;
  const tableEventView = EventView.fromNewQueryWithLocation(newQuery, location);

  const {
    data: topTransactionsData,
    isLoading: topTransactionsLoading,
    pageLinks,
  } = useTableQuery({
    eventView: tableEventView,
    enabled: !isReleasesLoading,
    referrer: Referrer.OVERVIEW_SCREENS_TABLE,
  });

  const topTransactions =
    topTransactionsData?.data?.slice(0, 5).map(datum => datum.transaction as string) ??
    [];

  // TODO: Fill with transaction.op filter
  const topEventsQuery = new MutableSearch([]);

  const topEventsQueryString = `${appendReleaseFilters(
    topEventsQuery,
    primaryRelease,
    secondaryRelease
  )} ${
    topTransactions.length > 0
      ? escapeFilterValue(
          `transaction:[${topTransactions.map(name => `"${name}"`).join()}]`
        )
      : ''
  }`.trim();

  const {data: releaseEvents, isLoading: isReleaseEventsLoading} = useTableQuery({
    eventView: EventView.fromNewQueryWithPageFilters(
      {
        name: '',
        fields: ['transaction', 'release', ...Y_AXIS_COLUMNS],
        yAxis: Y_AXIS_COLUMNS,
        query: topEventsQueryString,
        dataset: DiscoverDatasets.SPANS_METRICS,
        version: 2,
      },
      selection
    ),
    enabled: !topTransactionsLoading,
    referrer: Referrer.MOBILE_UI_BAR_CHART,
  });

  if (!defined(primaryRelease) && !isReleasesLoading) {
    return (
      <Alert type="warning" showIcon>
        {t(
          'No screens found on recent releases. Please try a single iOS or Android project, a single environment or a smaller date range.'
        )}
      </Alert>
    );
  }

  // TODO: Add transaction.op:ui.load when collecting begins
  const tableSearchFilters = new MutableSearch([]);

  const derivedQuery = getTransactionSearchQuery(location, tableEventView.query);

  const transformedReleaseEvents = transformReleaseEvents({
    yAxes: Y_AXES,
    primaryRelease,
    secondaryRelease,
    colorPalette: theme.charts.getColorPalette(TOP_SCREENS - 2),
    releaseEvents,
    topTransactions,
  });

  return (
    <Layout>
      <ChartContainer>
        <TopScreensChart
          yAxis={YAXIS_COLUMNS[YAxis.SLOW_FRAMES]}
          isLoading={isReleaseEventsLoading}
          chartHeight={200}
          topTransactions={topTransactions}
          transformedReleaseEvents={transformedReleaseEvents}
        />
        <TopScreensChart
          yAxis={YAXIS_COLUMNS[YAxis.FROZEN_FRAMES]}
          isLoading={isReleaseEventsLoading}
          chartHeight={200}
          topTransactions={topTransactions}
          transformedReleaseEvents={transformedReleaseEvents}
        />
        <TopScreensChart
          yAxis={YAXIS_COLUMNS[YAxis.FRAMES_DELAY]}
          isLoading={isReleaseEventsLoading}
          chartHeight={200}
          topTransactions={topTransactions}
          transformedReleaseEvents={transformedReleaseEvents}
        />
      </ChartContainer>
      <SearchBar
        eventView={tableEventView}
        onSearch={search => {
          router.push({
            pathname: router.location.pathname,
            query: {
              ...location.query,
              cursor: undefined,
              query: String(search).trim() || undefined,
            },
          });
        }}
        organization={organization}
        query={getFreeTextFromQuery(derivedQuery)}
        placeholder={t('Search for Screen')}
        additionalConditions={
          new MutableSearch(
            appendReleaseFilters(tableSearchFilters, primaryRelease, secondaryRelease)
          )
        }
      />
      <UIScreensTable
        eventView={tableEventView}
        data={topTransactionsData}
        isLoading={topTransactionsLoading}
        pageLinks={pageLinks}
      />
    </Layout>
  );
}

const Layout = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const ChartContainer = styled('div')`
  display: grid;
  grid-template-columns: 33% 33% 33%;
  gap: ${space(1)};
`;

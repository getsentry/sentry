import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import SearchBar from 'sentry/components/performance/searchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {NewQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {escapeFilterValue, MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {appendReleaseFilters} from 'sentry/views/insights/common/utils/releaseComparison';
import {TOP_SCREENS} from 'sentry/views/insights/mobile/constants';
import {getFreeTextFromQuery} from 'sentry/views/insights/mobile/screenload/components/screensView';
import {useTableQuery} from 'sentry/views/insights/mobile/screenload/components/tables/screensTable';
import {YAxis, YAXIS_COLUMNS} from 'sentry/views/insights/mobile/screenload/constants';
import {transformReleaseEvents} from 'sentry/views/insights/mobile/screenload/utils';
import {TopScreensChart} from 'sentry/views/insights/mobile/ui/components/charts/topScreensChart';
import {UIScreensTable} from 'sentry/views/insights/mobile/ui/components/tables/uiScreensTable';
import {Referrer} from 'sentry/views/insights/mobile/ui/referrers';
import {SpanMetricsField} from 'sentry/views/insights/types';
import {prepareQueryForLandingPage} from 'sentry/views/performance/data';
import {getTransactionSearchQuery} from 'sentry/views/performance/utils';

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

  const query = new MutableSearch(['transaction.op:ui.load']);

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
      `division_if(mobile.slow_frames,mobile.total_frames,release,${primaryRelease})`,
      `division_if(mobile.slow_frames,mobile.total_frames,release,${secondaryRelease})`,
      `division_if(mobile.frozen_frames,mobile.total_frames,release,${primaryRelease})`,
      `division_if(mobile.frozen_frames,mobile.total_frames,release,${secondaryRelease})`,
      `avg_if(mobile.frames_delay,release,${primaryRelease})`,
      `avg_if(mobile.frames_delay,release,${secondaryRelease})`,
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
    isPending: topTransactionsLoading,
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

  const {data: releaseEvents, isPending: isReleaseEventsLoading} = useTableQuery({
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

  const tableSearchFilters = new MutableSearch(['transaction.op:ui.load']);

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
        query={getFreeTextFromQuery(derivedQuery)!}
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

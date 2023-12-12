import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SearchBar from 'sentry/components/performance/searchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {NewQuery} from 'sentry/types';
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
import {getTransactionSearchQuery} from 'sentry/views/performance/utils';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {formatVersionAndCenterTruncate} from 'sentry/views/starfish/utils/centerTruncate';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {ScreensTable} from 'sentry/views/starfish/views/appStartup/screensTable';
import {
  getFreeTextFromQuery,
  TOP_SCREENS,
  YAxis,
  YAXIS_COLUMNS,
} from 'sentry/views/starfish/views/screens';
import {ScreensBarChart} from 'sentry/views/starfish/views/screens/screenBarChart';
import {useTableQuery} from 'sentry/views/starfish/views/screens/screensTable';
import {transformReleaseEvents} from 'sentry/views/starfish/views/screens/utils';

const MAX_CHART_RELEASE_CHARS = 12;
const Y_AXES = [YAxis.COLD_START, YAxis.WARM_START];
const Y_AXIS_COLS = [YAXIS_COLUMNS[YAxis.COLD_START], YAXIS_COLUMNS[YAxis.WARM_START]];

type Props = {
  additionalFilters?: string[];
  chartHeight?: number;
};

function AppStartup({additionalFilters, chartHeight}: Props) {
  const theme = useTheme();
  const pageFilter = usePageFilters();
  const {selection} = pageFilter;
  const location = useLocation();
  const organization = useOrganization();
  const {query: locationQuery} = location;

  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();

  const router = useRouter();

  const query = new MutableSearch([
    'event.type:transaction',
    'transaction.op:ui.load',
    ...(additionalFilters ?? []),
  ]);

  const searchQuery = decodeScalar(locationQuery.query, '');
  if (searchQuery) {
    query.addStringFilter(prepareQueryForLandingPage(searchQuery, false));
  }

  const queryString = `${appendReleaseFilters(
    query,
    primaryRelease,
    secondaryRelease
  )} (count_starts(measurements.app_start_cold):>0 OR count_starts(measurements.app_start_warm):>0)`;

  const orderby = decodeScalar(locationQuery.sort, `-count`);
  const newQuery: NewQuery = {
    name: '',
    fields: [
      'transaction',
      SpanMetricsField.PROJECT_ID,
      `avg_if(measurements.app_start_cold,release,${primaryRelease})`,
      `avg_if(measurements.app_start_cold,release,${secondaryRelease})`,
      `avg_if(measurements.app_start_warm,release,${primaryRelease})`,
      `avg_if(measurements.app_start_warm,release,${secondaryRelease})`,
      'count_starts(measurements.app_start_cold)',
      'count_starts(measurements.app_start_warm)',
      'count()',
    ],
    query: queryString,
    dataset: DiscoverDatasets.METRICS,
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
    referrer: 'api.starfish.mobile-startup-screen-table',
  });

  const topTransactions =
    topTransactionsData?.data?.slice(0, 5).map(datum => datum.transaction as string) ??
    [];

  const topEventsQuery = new MutableSearch([
    'event.type:transaction',
    'transaction.op:ui.load',
    ...(additionalFilters ?? []),
  ]);

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
    eventView: EventView.fromNewQueryWithLocation(
      {
        name: '',
        fields: ['transaction', 'release', ...Y_AXIS_COLS],
        orderby: Y_AXIS_COLS[0],
        yAxis: Y_AXIS_COLS,
        query: topEventsQueryString,
        dataset: DiscoverDatasets.METRICS,
        version: 2,
      },
      location
    ),
    enabled: !topTransactionsLoading,
    referrer: 'api.starfish.mobile-startup-bar-chart',
  });

  if (isReleasesLoading) {
    return (
      <LoadingContainer>
        <LoadingIndicator />
      </LoadingContainer>
    );
  }

  if (!defined(primaryRelease) && !isReleasesLoading) {
    return (
      <Alert type="warning" showIcon>
        {t(
          'No screens found on recent releases. Please try a single iOS or Android project, a single environment or a smaller date range.'
        )}
      </Alert>
    );
  }

  const derivedQuery = getTransactionSearchQuery(location, tableEventView.query);

  const tableSearchFilters = new MutableSearch([
    'event.type:transaction',
    'transaction.op:ui.load',
  ]);

  const transformedReleaseEvents = transformReleaseEvents({
    yAxes: Y_AXES,
    primaryRelease,
    secondaryRelease,
    colorPalette: theme.charts.getColorPalette(TOP_SCREENS - 2),
    releaseEvents,
    topTransactions,
  });

  const truncatedPrimaryChart = formatVersionAndCenterTruncate(
    primaryRelease ?? '',
    MAX_CHART_RELEASE_CHARS
  );
  const truncatedSecondaryChart = formatVersionAndCenterTruncate(
    secondaryRelease ?? '',
    MAX_CHART_RELEASE_CHARS
  );

  return (
    <div data-test-id="starfish-mobile-app-startup-view">
      <ChartContainer>
        <ScreensBarChart
          chartOptions={[
            {
              title: t('Cold Start by Top Screen'),
              yAxis: YAXIS_COLUMNS[YAxis.COLD_START],
              xAxisLabel: topTransactions,
              series: Object.values(
                transformedReleaseEvents[YAXIS_COLUMNS[YAxis.COLD_START]]
              ),
              subtitle: primaryRelease
                ? t(
                    '%s v. %s',
                    truncatedPrimaryChart,
                    secondaryRelease ? truncatedSecondaryChart : ''
                  )
                : '',
            },
          ]}
          chartHeight={chartHeight ?? 180}
          isLoading={isReleaseEventsLoading}
          chartKey="coldStart"
        />
        <ScreensBarChart
          chartOptions={[
            {
              title: t('Warm Start by Top Screen'),
              yAxis: YAXIS_COLUMNS[YAxis.WARM_START],
              xAxisLabel: topTransactions,
              series: Object.values(
                transformedReleaseEvents[YAXIS_COLUMNS[YAxis.WARM_START]]
              ),
              subtitle: primaryRelease
                ? t(
                    '%s v. %s',
                    truncatedPrimaryChart,
                    secondaryRelease ? truncatedSecondaryChart : ''
                  )
                : '',
            },
          ]}
          chartHeight={chartHeight ?? 180}
          isLoading={isReleaseEventsLoading}
          chartKey="warmStart"
        />
      </ChartContainer>
      <StyledSearchBar
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
        placeholder={t('Search for Screens')}
        additionalConditions={
          new MutableSearch(
            appendReleaseFilters(tableSearchFilters, primaryRelease, secondaryRelease)
          )
        }
      />
      <ScreensTable
        eventView={tableEventView}
        data={topTransactionsData}
        isLoading={topTransactionsLoading}
        pageLinks={pageLinks}
      />
    </div>
  );
}

export default AppStartup;

const StyledSearchBar = styled(SearchBar)`
  margin-bottom: ${space(1)};
`;

const ChartContainer = styled('div')`
  display: grid;
  grid-template-columns: 50% 50%;
  gap: ${space(1)};
`;

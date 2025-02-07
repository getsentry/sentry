import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import SearchBar from 'sentry/components/performance/searchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {NewQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
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
import {AverageComparisonChart} from 'sentry/views/insights/mobile/appStarts/components/charts/averageComparisonChart';
import {CountChart} from 'sentry/views/insights/mobile/appStarts/components/charts/countChart';
import {COLD_START_TYPE} from 'sentry/views/insights/mobile/appStarts/components/startTypeSelector';
import {AppStartScreens} from 'sentry/views/insights/mobile/appStarts/components/tables/screensTable';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import useTruncatedReleaseNames from 'sentry/views/insights/mobile/common/queries/useTruncatedRelease';
import {TOP_SCREENS} from 'sentry/views/insights/mobile/constants';
import {ScreensBarChart} from 'sentry/views/insights/mobile/screenload/components/charts/screenBarChart';
import {getFreeTextFromQuery} from 'sentry/views/insights/mobile/screenload/components/screensView';
import {useTableQuery} from 'sentry/views/insights/mobile/screenload/components/tables/screensTable';
import {YAxis, YAXIS_COLUMNS} from 'sentry/views/insights/mobile/screenload/constants';
import {transformReleaseEvents} from 'sentry/views/insights/mobile/screenload/utils';
import {ModuleName, SpanMetricsField} from 'sentry/views/insights/types';
import {prepareQueryForLandingPage} from 'sentry/views/performance/data';
import {getTransactionSearchQuery} from 'sentry/views/performance/utils';

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
  const {truncatedPrimaryRelease, truncatedSecondaryRelease} = useTruncatedReleaseNames();
  const {isProjectCrossPlatform, selectedPlatform} = useCrossPlatformProject();

  const router = useRouter();

  const appStartType =
    decodeScalar(location.query[SpanMetricsField.APP_START_TYPE]) ?? COLD_START_TYPE;

  const query = new MutableSearch([
    'event.type:transaction',
    'transaction.op:ui.load',
    `count_starts(measurements.app_start_${appStartType}):>0`,
    ...(additionalFilters ?? []),
  ]);

  if (isProjectCrossPlatform) {
    query.addFilterValue('os.name', selectedPlatform);
  }

  const searchQuery = decodeScalar(locationQuery.query, '');
  if (searchQuery) {
    query.addStringFilter(prepareQueryForLandingPage(searchQuery, false));
  }

  const queryString = appendReleaseFilters(query, primaryRelease, secondaryRelease);

  const sortCountField = `count_starts_measurements_app_start_${appStartType}`;
  const orderby = decodeScalar(locationQuery.sort, `-${sortCountField}`);
  const newQuery: NewQuery = {
    name: '',
    fields: [
      'transaction',
      SpanMetricsField.PROJECT_ID,
      `avg_if(measurements.app_start_${appStartType},release,${primaryRelease})`,
      `avg_if(measurements.app_start_${appStartType},release,${secondaryRelease})`,
      `avg_compare(measurements.app_start_${appStartType},release,${primaryRelease},${secondaryRelease})`,
      'count_starts(measurements.app_start_cold)',
      'count_starts(measurements.app_start_warm)',
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
    isPending: topTransactionsLoading,
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

  if (isProjectCrossPlatform) {
    topEventsQuery.addFilterValue('os.name', selectedPlatform);
  }

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
        fields: ['transaction', 'release', ...Y_AXIS_COLS],
        orderby: Y_AXIS_COLS[0],
        yAxis: Y_AXIS_COLS,
        query: topEventsQueryString,
        dataset: DiscoverDatasets.METRICS,
        version: 2,
      },
      selection
    ),
    enabled: !topTransactionsLoading,
    referrer: 'api.starfish.mobile-startup-bar-chart',
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

  const derivedQuery = getTransactionSearchQuery(location, tableEventView.query);

  const tableSearchFilters = new MutableSearch([
    'event.type:transaction',
    'transaction.op:ui.load',
  ]);

  const transformedReleaseEvents = transformReleaseEvents({
    yAxes: Y_AXES,
    primaryRelease,
    secondaryRelease,
    colorPalette: theme.charts.getColorPalette(TOP_SCREENS - 2) ?? [],
    releaseEvents,
    topTransactions,
  });

  const countTopScreens = Math.min(TOP_SCREENS, topTransactions.length);
  const [singularTopScreenTitle, pluralTopScreenTitle] =
    appStartType === COLD_START_TYPE
      ? [t('Top Screen Cold Start'), t('Top %s Screen Cold Starts', countTopScreens)]
      : [t('Top Screen Warm Start'), t('Top %s Screen Warm Starts', countTopScreens)];
  const yAxis =
    YAXIS_COLUMNS[appStartType === COLD_START_TYPE ? YAxis.COLD_START : YAxis.WARM_START];

  return (
    <div data-test-id="starfish-mobile-app-startup-view">
      <ChartContainer>
        <AverageComparisonChart chartHeight={chartHeight} />
        <ScreensBarChart
          chartOptions={[
            {
              title: countTopScreens > 1 ? pluralTopScreenTitle : singularTopScreenTitle,
              yAxis,
              xAxisLabel: topTransactions,
              series: Object.values(transformedReleaseEvents[yAxis]!),
              subtitle: primaryRelease
                ? t(
                    '%s v. %s',
                    truncatedPrimaryRelease,
                    secondaryRelease ? truncatedSecondaryRelease : ''
                  )
                : '',
            },
          ]}
          chartHeight={chartHeight}
          isLoading={isReleaseEventsLoading || isReleasesLoading}
          chartKey={`${appStartType}Start`}
        />
        <CountChart chartHeight={chartHeight} />
      </ChartContainer>
      <StyledSearchBar
        eventView={tableEventView}
        onSearch={search => {
          trackAnalytics('insight.general.search', {
            organization,
            query: search,
            source: ModuleName.APP_START,
          });
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
      <AppStartScreens
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
  grid-template-columns: 33% 33% 33%;
  gap: ${space(1)};
`;

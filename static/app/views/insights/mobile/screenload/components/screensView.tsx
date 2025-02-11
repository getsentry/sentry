import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {CursorHandler} from 'sentry/components/pagination';
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
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import ChartPanel from 'sentry/views/insights/common/components/chartPanel';
import {useTTFDConfigured} from 'sentry/views/insights/common/queries/useHasTtfdConfigured';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {appendReleaseFilters} from 'sentry/views/insights/common/utils/releaseComparison';
import {useHasDataTrackAnalytics} from 'sentry/views/insights/common/utils/useHasDataTrackAnalytics';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import useTruncatedReleaseNames from 'sentry/views/insights/mobile/common/queries/useTruncatedRelease';
import {TOP_SCREENS} from 'sentry/views/insights/mobile/constants';
import {ScreensBarChart} from 'sentry/views/insights/mobile/screenload/components/charts/screenBarChart';
import {TabbedCodeSnippet} from 'sentry/views/insights/mobile/screenload/components/tabbedCodeSnippets';
import {
  ScreensTable,
  useTableQuery,
} from 'sentry/views/insights/mobile/screenload/components/tables/screensTable';
import {
  CHART_TITLES,
  MobileCursors,
  YAxis,
  YAXIS_COLUMNS,
} from 'sentry/views/insights/mobile/screenload/constants';
import {SETUP_CONTENT} from 'sentry/views/insights/mobile/screenload/data/setupContent';
import {transformReleaseEvents} from 'sentry/views/insights/mobile/screenload/utils';
import {ModuleName, SpanMetricsField} from 'sentry/views/insights/types';
import {prepareQueryForLandingPage} from 'sentry/views/performance/data';
import {getTransactionSearchQuery} from 'sentry/views/performance/utils';

type Props = {
  yAxes: YAxis[];
  additionalFilters?: string[];
  chartHeight?: number;
};

export function ScreensView({yAxes, additionalFilters, chartHeight}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const pageFilter = usePageFilters();
  const {selection} = pageFilter;
  const theme = useTheme();
  const organization = useOrganization();
  const {isProjectCrossPlatform, selectedPlatform} = useCrossPlatformProject();
  const {query: locationQuery} = location;

  const cursor = decodeScalar(location.query?.[MobileCursors.SCREENS_TABLE]);

  const yAxisCols = yAxes.map(val => YAXIS_COLUMNS[val]);

  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();
  const {truncatedPrimaryRelease, truncatedSecondaryRelease} = useTruncatedReleaseNames();

  const router = useRouter();

  const {hasTTFD} = useTTFDConfigured(additionalFilters);

  const queryString = useMemo(() => {
    const query = new MutableSearch([
      'event.type:transaction',
      'transaction.op:ui.load',
      ...(additionalFilters ?? []),
    ]);

    if (isProjectCrossPlatform) {
      query.addFilterValue('os.name', selectedPlatform);
    }

    const searchQuery = decodeScalar(locationQuery.query, '');
    if (searchQuery) {
      query.addStringFilter(prepareQueryForLandingPage(searchQuery, false));
    }

    return appendReleaseFilters(query, primaryRelease, secondaryRelease);
  }, [
    additionalFilters,
    isProjectCrossPlatform,
    locationQuery.query,
    primaryRelease,
    secondaryRelease,
    selectedPlatform,
  ]);

  const orderby = decodeScalar(locationQuery.sort, `-count`);
  const newQuery: NewQuery = {
    name: '',
    fields: [
      'transaction',
      SpanMetricsField.PROJECT_ID,
      `avg_if(measurements.time_to_initial_display,release,${primaryRelease})`,
      `avg_if(measurements.time_to_initial_display,release,${secondaryRelease})`,
      `avg_if(measurements.time_to_full_display,release,${primaryRelease})`,
      `avg_if(measurements.time_to_full_display,release,${secondaryRelease})`,
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
    isPending: topTransactionsLoading,
    pageLinks,
  } = useTableQuery({
    eventView: tableEventView,
    enabled: !isReleasesLoading,
    referrer: 'api.starfish.mobile-screen-table',
    cursor,
  });

  const topTransactions = useMemo(() => {
    return (
      topTransactionsData?.data?.slice(0, 5).map(datum => datum.transaction as string) ??
      []
    );
  }, [topTransactionsData?.data]);

  const topEventsQueryString = useMemo(() => {
    const topEventsQuery = new MutableSearch([
      'event.type:transaction',
      'transaction.op:ui.load',
      ...(additionalFilters ?? []),
    ]);

    if (isProjectCrossPlatform) {
      topEventsQuery.addFilterValue('os.name', selectedPlatform);
    }

    return `${appendReleaseFilters(topEventsQuery, primaryRelease, secondaryRelease)} ${
      topTransactions.length > 0
        ? escapeFilterValue(
            `transaction:[${topTransactions.map(name => `"${name}"`).join()}]`
          )
        : ''
    }`.trim();
  }, [
    additionalFilters,
    isProjectCrossPlatform,
    primaryRelease,
    secondaryRelease,
    topTransactions,
    selectedPlatform,
  ]);

  const {data: releaseEvents, isPending: isReleaseEventsLoading} = useTableQuery({
    eventView: EventView.fromNewQueryWithLocation(
      {
        name: '',
        fields: ['transaction', 'release', ...yAxisCols],
        orderby: yAxisCols[0],
        yAxis: yAxisCols,
        query: topEventsQueryString,
        dataset: DiscoverDatasets.METRICS,
        version: 2,
      },
      location
    ),
    enabled: !topTransactionsLoading,
    referrer: 'api.starfish.mobile-screen-bar-chart',
  });

  useHasDataTrackAnalytics(ModuleName.SCREEN_LOAD, 'insight.page_loads.screen_load');

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

  const transformedReleaseEvents = transformReleaseEvents({
    yAxes,
    primaryRelease,
    secondaryRelease,
    colorPalette: theme.charts.getColorPalette(TOP_SCREENS - 2) ?? [],
    releaseEvents,
    topTransactions,
  });

  const derivedQuery = getTransactionSearchQuery(location, tableEventView.query);

  const tableSearchFilters = new MutableSearch(['transaction.op:ui.load']);

  const handleCursor: CursorHandler = (newCursor, pathname, query_) => {
    navigate({
      pathname,
      query: {...query_, [MobileCursors.SCREENS_TABLE]: newCursor},
    });
  };

  return (
    <div data-test-id="starfish-mobile-view">
      <ChartsContainer>
        <Fragment>
          <ChartsContainerItem key="ttid">
            <ScreensBarChart
              chartOptions={[
                {
                  title: t('%s by Top Screen', CHART_TITLES[yAxes[0]!]),
                  yAxis: YAXIS_COLUMNS[yAxes[0]!],
                  xAxisLabel: topTransactions,
                  series: Object.values(
                    transformedReleaseEvents[YAXIS_COLUMNS[yAxes[0]!]]!
                  ),
                  subtitle: primaryRelease
                    ? t(
                        '%s v. %s',
                        truncatedPrimaryRelease,
                        secondaryRelease ? truncatedSecondaryRelease : ''
                      )
                    : '',
                },
              ]}
              chartHeight={chartHeight ?? 180}
              isLoading={isReleaseEventsLoading}
              chartKey="screensChart1"
            />
          </ChartsContainerItem>

          {defined(hasTTFD) && !hasTTFD && yAxes[1] === YAxis.TTFD ? (
            <ChartsContainerWithHiddenOverflow>
              <ChartPanel title={CHART_TITLES[yAxes[1]]}>
                <TabbedCodeSnippet tabs={SETUP_CONTENT} />
              </ChartPanel>
            </ChartsContainerWithHiddenOverflow>
          ) : (
            <ChartsContainerItem key="ttfd">
              <ScreensBarChart
                chartOptions={[
                  {
                    title: t('%s by Top Screen', CHART_TITLES[yAxes[1]!]),
                    yAxis: YAXIS_COLUMNS[yAxes[1]!],
                    xAxisLabel: topTransactions,
                    series: Object.values(
                      transformedReleaseEvents[YAXIS_COLUMNS[yAxes[1]!]]!
                    ),
                    subtitle: primaryRelease
                      ? t(
                          '%s v. %s',
                          truncatedPrimaryRelease,
                          secondaryRelease ? truncatedSecondaryRelease : ''
                        )
                      : '',
                  },
                ]}
                chartHeight={chartHeight ?? 180}
                isLoading={isReleaseEventsLoading}
                chartKey="screensChart1"
              />
            </ChartsContainerItem>
          )}
        </Fragment>
      </ChartsContainer>
      <StyledSearchBar
        eventView={tableEventView}
        onSearch={search => {
          trackAnalytics('insight.general.search', {
            organization,
            query: search,
            source: ModuleName.SCREEN_LOAD,
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
        onCursor={handleCursor}
      />
    </div>
  );
}

export function getFreeTextFromQuery(query: string) {
  const conditions = new MutableSearch(query);
  const transactionValues = conditions.getFilterValues('transaction');
  if (transactionValues.length) {
    return transactionValues[0];
  }
  if (conditions.freeText.length > 0) {
    // raw text query will be wrapped in wildcards in generatePerformanceEventView
    // so no need to wrap it here
    return conditions.freeText.join(' ');
  }
  return '';
}

const ChartsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${space(2)};
`;

const ChartsContainerWithHiddenOverflow = styled('div')`
  flex: 1;
  overflow: hidden;
`;

const ChartsContainerItem = styled('div')`
  flex: 1;
`;

export const Spacer = styled('div')`
  margin-top: ${space(3)};
`;

const StyledSearchBar = styled(SearchBar)`
  margin-bottom: ${space(1)};
`;

import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {CursorHandler} from 'sentry/components/pagination';
import SearchBar from 'sentry/components/performance/searchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {NewQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import EventView from 'sentry/utils/discover/eventView';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {escapeFilterValue, MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {prepareQueryForLandingPage} from 'sentry/views/performance/data';
import {TOP_SCREENS} from 'sentry/views/performance/mobile/constants';
import {MobileCursors} from 'sentry/views/performance/mobile/screenload/screens/constants';
import {ScreensBarChart} from 'sentry/views/performance/mobile/screenload/screens/screenBarChart';
import {
  ScreensTable,
  useTableQuery,
} from 'sentry/views/performance/mobile/screenload/screens/screensTable';
import {SETUP_CONTENT} from 'sentry/views/performance/mobile/screenload/screens/setupContent';
import {TabbedCodeSnippet} from 'sentry/views/performance/mobile/screenload/screens/tabbedCodeSnippets';
import {transformReleaseEvents} from 'sentry/views/performance/mobile/screenload/screens/utils';
import useCrossPlatformProject from 'sentry/views/performance/mobile/useCrossPlatformProject';
import useTruncatedReleaseNames from 'sentry/views/performance/mobile/useTruncatedRelease';
import {getTransactionSearchQuery} from 'sentry/views/performance/utils';
import {useHasDataTrackAnalytics} from 'sentry/views/performance/utils/analytics/useHasDataTrackAnalytics';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {useTTFDConfigured} from 'sentry/views/starfish/queries/useHasTtfdConfigured';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {ModuleName, SpanMetricsField} from 'sentry/views/starfish/types';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';

export enum YAxis {
  WARM_START = 0,
  COLD_START = 1,
  TTID = 2,
  TTFD = 3,
  SLOW_FRAME_RATE = 4,
  FROZEN_FRAME_RATE = 5,
  THROUGHPUT = 6,
  COUNT = 7,
  SLOW_FRAMES = 8,
  FROZEN_FRAMES = 9,
  FRAMES_DELAY = 10,
}

export const YAXIS_COLUMNS: Readonly<Record<YAxis, string>> = {
  [YAxis.WARM_START]: 'avg(measurements.app_start_warm)',
  [YAxis.COLD_START]: 'avg(measurements.app_start_cold)',
  [YAxis.TTID]: 'avg(measurements.time_to_initial_display)',
  [YAxis.TTFD]: 'avg(measurements.time_to_full_display)',
  [YAxis.SLOW_FRAME_RATE]: 'avg(measurements.frames_slow_rate)',
  [YAxis.FROZEN_FRAME_RATE]: 'avg(measurements.frames_frozen_rate)',
  [YAxis.THROUGHPUT]: 'tpm()',
  [YAxis.COUNT]: 'count()',

  // Using span metrics
  [YAxis.SLOW_FRAMES]: 'avg(mobile.slow_frames)',
  [YAxis.FROZEN_FRAMES]: 'avg(mobile.frozen_frames)',
  [YAxis.FRAMES_DELAY]: 'avg(mobile.frames_delay)',
};

export const READABLE_YAXIS_LABELS: Readonly<Record<YAxis, string>> = {
  [YAxis.WARM_START]: 'avg(app_start_warm)',
  [YAxis.COLD_START]: 'avg(app_start_cold)',
  [YAxis.TTID]: 'avg(time_to_initial_display)',
  [YAxis.TTFD]: 'avg(time_to_full_display)',
  [YAxis.SLOW_FRAME_RATE]: 'avg(frames_slow_rate)',
  [YAxis.FROZEN_FRAME_RATE]: 'avg(frames_frozen_rate)',
  [YAxis.THROUGHPUT]: 'tpm()',
  [YAxis.COUNT]: 'count()',
  [YAxis.SLOW_FRAMES]: 'avg(mobile.slow_frames)',
  [YAxis.FROZEN_FRAMES]: 'avg(mobile.frozen_frames)',
  [YAxis.FRAMES_DELAY]: 'avg(mobile.frames_delay)',
};

export const CHART_TITLES: Readonly<Record<YAxis, string>> = {
  [YAxis.WARM_START]: t('Warm Start'),
  [YAxis.COLD_START]: t('Cold Start'),
  [YAxis.TTID]: t('Time To Initial Display'),
  [YAxis.TTFD]: t('Time To Full Display'),
  [YAxis.SLOW_FRAME_RATE]: t('Slow Frame Rate'),
  [YAxis.FROZEN_FRAME_RATE]: t('Frozen Frame Rate'),
  [YAxis.THROUGHPUT]: t('Throughput'),
  [YAxis.COUNT]: t('Total Count'),
  [YAxis.SLOW_FRAMES]: t('Slow Frames'),
  [YAxis.FROZEN_FRAMES]: t('Frozen Frames'),
  [YAxis.FRAMES_DELAY]: t('Frames Delay'),
};

export const OUTPUT_TYPE: Readonly<Record<YAxis, AggregationOutputType>> = {
  [YAxis.WARM_START]: 'duration',
  [YAxis.COLD_START]: 'duration',
  [YAxis.TTID]: 'duration',
  [YAxis.TTFD]: 'duration',
  [YAxis.SLOW_FRAME_RATE]: 'percentage',
  [YAxis.FROZEN_FRAME_RATE]: 'percentage',
  [YAxis.THROUGHPUT]: 'number',
  [YAxis.COUNT]: 'number',
  [YAxis.SLOW_FRAMES]: 'number',
  [YAxis.FROZEN_FRAMES]: 'number',
  [YAxis.FRAMES_DELAY]: 'duration',
};

type Props = {
  yAxes: YAxis[];
  additionalFilters?: string[];
  chartHeight?: number;
};

export function ScreensView({yAxes, additionalFilters, chartHeight}: Props) {
  const pageFilter = usePageFilters();
  const {selection} = pageFilter;
  const location = useLocation();
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
    isLoading: topTransactionsLoading,
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

  const {data: releaseEvents, isLoading: isReleaseEventsLoading} = useTableQuery({
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

  useHasDataTrackAnalytics(
    new MutableSearch('transaction.op:ui.load'),
    'api.performance.mobile.screen-load-landing',
    'insight.page_loads.screen_load'
  );

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
    colorPalette: theme.charts.getColorPalette(TOP_SCREENS - 2),
    releaseEvents,
    topTransactions,
  });

  const derivedQuery = getTransactionSearchQuery(location, tableEventView.query);

  const tableSearchFilters = new MutableSearch(['transaction.op:ui.load']);

  const handleCursor: CursorHandler = (newCursor, pathname, query_) => {
    browserHistory.push({
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
                  title: t('%s by Top Screen', CHART_TITLES[yAxes[0]]),
                  yAxis: YAXIS_COLUMNS[yAxes[0]],
                  xAxisLabel: topTransactions,
                  series: Object.values(
                    transformedReleaseEvents[YAXIS_COLUMNS[yAxes[0]]]
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
                    title: t('%s by Top Screen', CHART_TITLES[yAxes[1]]),
                    yAxis: YAXIS_COLUMNS[yAxes[1]],
                    xAxisLabel: topTransactions,
                    series: Object.values(
                      transformedReleaseEvents[YAXIS_COLUMNS[yAxes[1]]]
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

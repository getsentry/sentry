import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import Color from 'color';

import Alert from 'sentry/components/alert';
import _EventsRequest from 'sentry/components/charts/eventsRequest';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SearchBar from 'sentry/components/performance/searchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {NewQuery} from 'sentry/types';
import {Series, SeriesDataUnit} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {AggregationOutputType} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {prepareQueryForLandingPage} from 'sentry/views/performance/data';
import {getTransactionSearchQuery} from 'sentry/views/performance/utils';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {useTTFDConfigured} from 'sentry/views/starfish/queries/useHasTtfdConfigured';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {formatVersionAndCenterTruncate} from 'sentry/views/starfish/utils/centerTruncate';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {ScreensBarChart} from 'sentry/views/starfish/views/screens/screenBarChart';
import {
  ScreensTable,
  useTableQuery,
} from 'sentry/views/starfish/views/screens/screensTable';
import {SETUP_CONTENT} from 'sentry/views/starfish/views/screens/setupContent';
import {TabbedCodeSnippet} from 'sentry/views/starfish/views/screens/tabbedCodeSnippets';

export enum YAxis {
  WARM_START,
  COLD_START,
  TTID,
  TTFD,
  SLOW_FRAME_RATE,
  FROZEN_FRAME_RATE,
  THROUGHPUT,
  COUNT,
}

export const TOP_SCREENS = 5;

export const YAXIS_COLUMNS: Readonly<Record<YAxis, string>> = {
  [YAxis.WARM_START]: 'avg(measurements.app_start_warm)',
  [YAxis.COLD_START]: 'avg(measurements.app_start_cold)',
  [YAxis.TTID]: 'avg(measurements.time_to_initial_display)',
  [YAxis.TTFD]: 'avg(measurements.time_to_full_display)',
  [YAxis.SLOW_FRAME_RATE]: 'avg(measurements.frames_slow_rate)',
  [YAxis.FROZEN_FRAME_RATE]: 'avg(measurements.frames_frozen_rate)',
  [YAxis.THROUGHPUT]: 'tpm()',
  [YAxis.COUNT]: 'count()',
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
};

export const CHART_TITLES: Readonly<Record<YAxis, string>> = {
  [YAxis.WARM_START]: t('Warm Start'),
  [YAxis.COLD_START]: t('Cold Start'),
  [YAxis.TTID]: t('Time To Initial Display'),
  [YAxis.TTFD]: t('Time To Full Display'),
  [YAxis.SLOW_FRAME_RATE]: t('Slow Frame Rate'),
  [YAxis.FROZEN_FRAME_RATE]: t('Frozen Frame Rate'),
  [YAxis.THROUGHPUT]: t('Throughput'),
  [YAxis.COUNT]: t('Count'),
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
  const {query: locationQuery} = location;

  const yAxisCols = yAxes.map(val => YAXIS_COLUMNS[val]);

  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();

  const router = useRouter();

  const {hasTTFD} = useTTFDConfigured(additionalFilters);

  const query = new MutableSearch([
    'event.type:transaction',
    'transaction.op:ui.load',
    ...(additionalFilters ?? []),
  ]);

  const searchQuery = decodeScalar(locationQuery.query, '');
  if (searchQuery) {
    query.addStringFilter(prepareQueryForLandingPage(searchQuery, false));
  }

  const queryString = appendReleaseFilters(query, primaryRelease, secondaryRelease);

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
  });

  const topTransactions =
    topTransactionsData?.data?.slice(0, 5).map(datum => datum.transaction as string) ??
    [];

  const topEventsQuery = new MutableSearch([
    'event.type:transaction',
    'transaction.op:ui.load',
    ...(topTransactions.length > 0
      ? [`transaction:[${topTransactions.map(transaction => `"${transaction}"`).join()}]`]
      : []),
    ...(additionalFilters ?? []),
  ]);

  const topEventsQueryString = appendReleaseFilters(
    topEventsQuery,
    primaryRelease,
    secondaryRelease
  );

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
  });

  if (isReleasesLoading) {
    return (
      <LoadingContainer>
        <LoadingIndicator />
      </LoadingContainer>
    );
  }

  const transformedReleaseEvents: {
    [yAxisName: string]: {
      [releaseVersion: string]: Series;
    };
  } = {};

  yAxes.forEach(val => {
    transformedReleaseEvents[YAXIS_COLUMNS[val]] = {};
    if (primaryRelease) {
      transformedReleaseEvents[YAXIS_COLUMNS[val]][primaryRelease] = {
        seriesName: primaryRelease,
        data: Array(topTransactions.length).fill(0),
      };
    }
    if (secondaryRelease) {
      transformedReleaseEvents[YAXIS_COLUMNS[val]][secondaryRelease] = {
        seriesName: secondaryRelease,
        data: Array(topTransactions.length).fill(0),
      };
    }
  });

  const topTransactionsIndex = Object.fromEntries(topTransactions.map((e, i) => [e, i]));

  if (defined(releaseEvents) && defined(primaryRelease)) {
    releaseEvents.data?.forEach(row => {
      const release = row.release;
      const isPrimary = release === primaryRelease;
      const transaction = row.transaction;
      const index = topTransactionsIndex[transaction];
      yAxes.forEach(val => {
        transformedReleaseEvents[YAXIS_COLUMNS[val]][release].data[index] = {
          name: row.transaction,
          value: row[YAXIS_COLUMNS[val]],
          itemStyle: {
            color: isPrimary
              ? theme.charts.getColorPalette(TOP_SCREENS - 2)[index]
              : Color(theme.charts.getColorPalette(TOP_SCREENS - 2)[index])
                  .lighten(0.3)
                  .string(),
          },
        } as SeriesDataUnit;
      });
    });
  }

  const derivedQuery = getTransactionSearchQuery(location, tableEventView.query);

  const tableSearchFilters = new MutableSearch(['transaction.op:ui.load']);

  return (
    <div data-test-id="starfish-mobile-view">
      {!defined(primaryRelease) && !isReleaseEventsLoading && (
        <Alert type="warning" showIcon>
          {t(
            'No screens found on recent releases. Please try a single iOS or Android project or a smaller date range.'
          )}
        </Alert>
      )}
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
                        formatVersionAndCenterTruncate(primaryRelease, 12),
                        secondaryRelease
                          ? formatVersionAndCenterTruncate(secondaryRelease, 12)
                          : ''
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
                          formatVersionAndCenterTruncate(primaryRelease, 12),
                          secondaryRelease
                            ? formatVersionAndCenterTruncate(secondaryRelease, 12)
                            : ''
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

function getFreeTextFromQuery(query: string) {
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

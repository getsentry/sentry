import {Fragment} from 'react';
import styled from '@emotion/styled';
import Color from 'color';

import {BarChart} from 'sentry/components/charts/barChart';
import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {getInterval} from 'sentry/components/charts/utils';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Series, SeriesDataUnit} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {AggregationOutputType} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import MiniChartPanel from 'sentry/views/starfish/components/miniChartPanel';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {useTableQuery} from 'sentry/views/starfish/views/screens/screensTable';

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
  const location = useLocation();

  const yAxisCols = yAxes.map(val => YAXIS_COLUMNS[val]);

  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();

  const query = new MutableSearch([
    'event.type:transaction',
    'transaction.op:ui.load',
    ...(additionalFilters ?? []),
  ]);
  const queryString = appendReleaseFilters(query, primaryRelease, secondaryRelease);

  useSynchronizeCharts();
  const {data: topTransactionsData, isLoading: topTransactionsLoading} = useTableQuery({
    eventView: EventView.fromNewQueryWithLocation(
      {
        name: '',
        fields: ['transaction', 'count()'],
        orderby: '-count',
        query: queryString,
        dataset: DiscoverDatasets.METRICS,
        version: 2,
        interval: getInterval(
          pageFilter.selection.datetime,
          STARFISH_CHART_INTERVAL_FIDELITY
        ),
      },
      location
    ),
    enabled: !isReleasesLoading,
    limit: 5,
  });

  const topTransactions =
    topTransactionsData?.data?.map(datum => datum.transaction) ?? [];

  const topEventsQuery = new MutableSearch([
    'event.type:transaction',
    'transaction.op:ui.load',
    ...(topTransactions.length > 0 ? [`transaction:[${topTransactions.join()}]`] : []),
    ...(additionalFilters ?? []),
  ]);

  const topEventsQueryString = appendReleaseFilters(
    topEventsQuery,
    primaryRelease,
    secondaryRelease
  );

  const {data: releaseEvents} = useTableQuery({
    eventView: EventView.fromNewQueryWithLocation(
      {
        name: '',
        fields: ['transaction', 'release', ...yAxisCols],
        orderby: yAxisCols[0],
        yAxis: yAxisCols,
        query: topEventsQueryString,
        dataset: DiscoverDatasets.METRICS,
        version: 2,
        interval: getInterval(
          pageFilter.selection.datetime,
          STARFISH_CHART_INTERVAL_FIDELITY
        ),
      },
      location
    ),
    enabled: !topTransactionsLoading,
  });

  if (isReleasesLoading) {
    return <LoadingContainer />;
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

  const transformedReleaseSeries: {
    [yAxisName: string]: {
      [releaseVersion: string]: {[deviceClass: string]: Series | undefined};
    };
  } = {};
  yAxes.forEach(val => {
    transformedReleaseSeries[YAXIS_COLUMNS[val]] = {};
    if (primaryRelease) {
      transformedReleaseSeries[YAXIS_COLUMNS[val]][primaryRelease] = {};
    }
    if (secondaryRelease) {
      transformedReleaseSeries[YAXIS_COLUMNS[val]][secondaryRelease] = {};
    }
  });

  const topTransactionsIndex = Object.fromEntries(topTransactions.map((e, i) => [e, i]));

  function renderBarCharts() {
    if (defined(releaseEvents)) {
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
                ? CHART_PALETTE[6][index]
                : Color(CHART_PALETTE[6][index]).lighten(0.5).string(),
            },
          } as SeriesDataUnit;
        });
      });
    }

    return (
      <Fragment>
        {yAxes.map(val => {
          return (
            <ChartsContainerItem key={val}>
              <MiniChartPanel title={CHART_TITLES[val]}>
                <BarChart
                  height={chartHeight ?? 180}
                  series={Object.values(transformedReleaseEvents[YAXIS_COLUMNS[val]])}
                  grid={{
                    left: '0',
                    right: '0',
                    top: '16px',
                    bottom: '0',
                  }}
                  xAxis={{
                    type: 'category',
                    data: topTransactions,
                    axisTick: {
                      interval: 5,
                      alignWithLabel: true,
                    },
                  }}
                />
              </MiniChartPanel>
            </ChartsContainerItem>
          );
        })}
      </Fragment>
    );
  }

  return (
    <div data-test-id="starfish-mobile-view">
      <ChartsContainer>{renderBarCharts()}</ChartsContainer>
    </div>
  );
}

const ChartsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${space(2)};
`;

const ChartsContainerItem = styled('div')`
  flex: 1;
`;

export const Spacer = styled('div')`
  margin-top: ${space(3)};
`;

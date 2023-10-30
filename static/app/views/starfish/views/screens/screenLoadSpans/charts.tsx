import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import Color from 'color';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {getInterval} from 'sentry/components/charts/utils';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import {PerformanceLayoutBodyRow} from 'sentry/components/performance/layouts';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {space} from 'sentry/styles/space';
import {Series, SeriesDataUnit} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {tooltipFormatterUsingAggregateOutputType} from 'sentry/utils/discover/charts';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import Chart, {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import MiniChartPanel from 'sentry/views/starfish/components/miniChartPanel';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {useEventsStatsQuery} from 'sentry/views/starfish/utils/useEventsStatsQuery';
import {
  CHART_TITLES,
  OUTPUT_TYPE,
  YAXIS_COLUMNS,
} from 'sentry/views/starfish/views/screens';
import {ScreensBarChart} from 'sentry/views/starfish/views/screens/screenBarChart';
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

type Props = {
  yAxes: YAxis[];
  additionalFilters?: string[];
  chartHeight?: number;
};

export function ScreenCharts({yAxes, additionalFilters, chartHeight}: Props) {
  const pageFilter = usePageFilters();
  const location = useLocation();
  const theme = useTheme();

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
  const {
    isLoading: seriesIsLoading,
    data: releaseCountSeries,
    isError,
  } = useEventsStatsQuery({
    eventView: EventView.fromNewQueryWithPageFilters(
      {
        name: '',
        fields: ['release', 'count()'],
        topEvents: '2',
        yAxis: ['count()'],
        query: queryString,
        dataset: DiscoverDatasets.METRICS,
        version: 2,
        interval: getInterval(
          pageFilter.selection.datetime,
          STARFISH_CHART_INTERVAL_FIDELITY
        ),
      },
      pageFilter.selection
    ),
    enabled: !isReleasesLoading,
    // TODO: Change referrer
    referrer: 'api.starfish-web-service.span-category-breakdown-timeseries',
    initialData: {},
  });

  const {data: deviceClassEvents, isLoading: isDeviceClassEventsLoading} = useTableQuery({
    eventView: EventView.fromNewQueryWithLocation(
      {
        name: '',
        fields: ['device.class', 'release', ...yAxisCols],
        orderby: yAxisCols[0],
        yAxis: yAxisCols,
        query: queryString,
        dataset: DiscoverDatasets.METRICS,
        version: 2,
      },
      location
    ),
    enabled: !isReleasesLoading,
  });

  if (isReleasesLoading) {
    return <LoadingContainer />;
  }

  function getTransformedRelease(series) {
    return Object.keys(series).map((release, index) => {
      const data =
        series[release]?.data.map(datum => {
          return {
            name: datum[0] * 1000,
            value: datum[1][0].count,
          } as SeriesDataUnit;
        }) ?? [];

      return {
        seriesName: release,
        color: CHART_PALETTE[2][index],
        data,
      };
    });
  }

  const transformedEvents: {
    [yAxisName: string]: {
      [releaseVersion: string]: Series;
    };
  } = {};

  yAxes.forEach(val => {
    transformedEvents[YAXIS_COLUMNS[val]] = {};
    if (primaryRelease) {
      transformedEvents[YAXIS_COLUMNS[val]][primaryRelease] = {
        seriesName: primaryRelease,
        data: Array(['high', 'medium', 'low', 'Unknown'].length).fill(0),
      };
    }
    if (secondaryRelease) {
      transformedEvents[YAXIS_COLUMNS[val]][secondaryRelease] = {
        seriesName: secondaryRelease,
        data: Array(['high', 'medium', 'low', 'Unknown'].length).fill(0),
      };
    }
  });

  const deviceClassIndex = Object.fromEntries(
    ['high', 'medium', 'low', 'Unknown'].map((e, i) => [e, i])
  );

  if (defined(deviceClassEvents)) {
    deviceClassEvents.data?.forEach(row => {
      const deviceClass = row['device.class'];
      const index = deviceClassIndex[deviceClass];

      const release = row.release;
      const isPrimary = release === primaryRelease;
      yAxes.forEach(val => {
        transformedEvents[YAXIS_COLUMNS[val]][release].data[index] = {
          name: deviceClass,
          value: row[YAXIS_COLUMNS[val]],
          itemStyle: {
            color: isPrimary ? theme.gray300 : Color(theme.gray300).lighten(0.5).string(),
          },
        } as SeriesDataUnit;
      });
    });
  }

  function renderCharts() {
    return (
      <Fragment>
        <ChartsContainerItem>
          <MiniChartPanel title={CHART_TITLES[YAxis.COUNT]}>
            <Chart
              height={chartHeight ?? 180}
              data={
                defined(releaseCountSeries)
                  ? getTransformedRelease(releaseCountSeries)
                  : []
              }
              loading={seriesIsLoading}
              utc={false}
              grid={{
                left: '0',
                right: '0',
                top: '16px',
                bottom: '0',
              }}
              showLegend
              definedAxisTicks={2}
              isLineChart
              aggregateOutputFormat={OUTPUT_TYPE[YAxis.COUNT]}
              tooltipFormatterOptions={{
                valueFormatter: value =>
                  tooltipFormatterUsingAggregateOutputType(
                    value,
                    OUTPUT_TYPE[YAxis.COUNT]
                  ),
              }}
              errored={isError}
            />
          </MiniChartPanel>
        </ChartsContainerItem>
        <ChartsContainerItem key="deviceClass">
          <ScreensBarChart
            chartOptions={yAxes.map(yAxis => {
              return {
                title: CHART_TITLES[yAxis],
                yAxis: YAXIS_COLUMNS[yAxis],
                series: Object.values(transformedEvents[YAXIS_COLUMNS[yAxis]]),
                xAxisLabel: ['high', 'medium', 'low', 'Unknown'],
              };
            })}
            chartHeight={chartHeight ?? 180}
            isLoading={isDeviceClassEventsLoading}
          />
        </ChartsContainerItem>
      </Fragment>
    );
  }

  return (
    <div data-test-id="starfish-mobile-view">
      <StyledRow minSize={200}>
        <ChartsContainer>{renderCharts()}</ChartsContainer>
      </StyledRow>
    </div>
  );
}

const StyledRow = styled(PerformanceLayoutBodyRow)`
  margin-bottom: ${space(2)};
`;

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

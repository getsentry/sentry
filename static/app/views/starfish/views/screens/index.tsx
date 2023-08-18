import {Fragment} from 'react';
import styled from '@emotion/styled';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {getInterval} from 'sentry/components/charts/utils';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import {PerformanceLayoutBodyRow} from 'sentry/components/performance/layouts';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Series, SeriesDataUnit} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {tooltipFormatterUsingAggregateOutputType} from 'sentry/utils/discover/charts';
import EventView from 'sentry/utils/discover/eventView';
import {AggregationOutputType} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import Chart, {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import MiniChartPanel from 'sentry/views/starfish/components/miniChartPanel';
import {useReleases} from 'sentry/views/starfish/queries/useReleases';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {useEventsStatsQuery} from 'sentry/views/starfish/utils/useEventsStatsQuery';

export enum YAxis {
  WARM_START,
  COLD_START,
  TTID,
  TTFD,
  SLOW_FRAME_RATE,
  FROZEN_FRAME_RATE,
}

export const YAXIS_COLUMNS: Readonly<Record<YAxis, string>> = {
  [YAxis.WARM_START]: 'avg(measurements.app_start_warm)',
  [YAxis.COLD_START]: 'avg(measurements.app_start_cold)',
  [YAxis.TTID]: 'avg(measurements.time_to_initial_display)',
  [YAxis.TTFD]: 'avg(measurements.time_to_full_display)',
  [YAxis.SLOW_FRAME_RATE]: 'avg(measurements.frames_slow_rate)',
  [YAxis.FROZEN_FRAME_RATE]: 'avg(measurements.frames_frozen_rate)',
};

export const READABLE_YAXIS_LABELS: Readonly<Record<YAxis, string>> = {
  [YAxis.WARM_START]: 'avg(app_start_warm)',
  [YAxis.COLD_START]: 'avg(app_start_cold)',
  [YAxis.TTID]: 'avg(time_to_initial_display)',
  [YAxis.TTFD]: 'avg(time_to_full_display)',
  [YAxis.SLOW_FRAME_RATE]: 'avg(frames_slow_rate)',
  [YAxis.FROZEN_FRAME_RATE]: 'avg(frames_frozen_rate)',
};

export const CHART_TITLES: Readonly<Record<YAxis, string>> = {
  [YAxis.WARM_START]: t('App Warm Start'),
  [YAxis.COLD_START]: t('App Cold Start'),
  [YAxis.TTID]: t('Time To Initial Display'),
  [YAxis.TTFD]: t('Time To Full Display'),
  [YAxis.SLOW_FRAME_RATE]: t('Slow Frame Rate'),
  [YAxis.FROZEN_FRAME_RATE]: t('Frozen Frame Rate'),
};

export const OUTPUT_TYPE: Readonly<Record<YAxis, AggregationOutputType>> = {
  [YAxis.WARM_START]: 'duration',
  [YAxis.COLD_START]: 'duration',
  [YAxis.TTID]: 'duration',
  [YAxis.TTFD]: 'duration',
  [YAxis.SLOW_FRAME_RATE]: 'percentage',
  [YAxis.FROZEN_FRAME_RATE]: 'percentage',
};

export function ScreensView({yAxes}: {yAxes: YAxis[]}) {
  const pageFilter = usePageFilters();
  const location = useLocation();
  const {data: releases, isLoading: isReleasesLoading} = useReleases();

  const yAxisCols = yAxes.map(val => YAXIS_COLUMNS[val]);

  const primaryRelease =
    decodeScalar(location.query.primaryRelease) ?? releases?.[0]?.version ?? undefined;

  const secondaryRelease =
    decodeScalar(location.query.secondaryRelease) ?? releases?.[0]?.version ?? undefined;

  const query = new MutableSearch(['event.type:transaction', 'transaction.op:ui.load']);

  let queryString: string = query.formatString();
  if (
    defined(primaryRelease) &&
    defined(secondaryRelease) &&
    primaryRelease !== secondaryRelease
  ) {
    queryString = query
      .copy()
      .addStringFilter(`release:[${primaryRelease},${secondaryRelease}]`)
      .formatString();
  } else if (defined(primaryRelease)) {
    queryString = query
      .copy()
      .addStringFilter(`release:${primaryRelease}`)
      .formatString();
  }

  useSynchronizeCharts();
  const {
    isLoading: seriesIsLoading,
    data: releaseSeries,
    isError,
  } = useEventsStatsQuery({
    eventView: EventView.fromNewQueryWithPageFilters(
      {
        name: '',
        fields: ['release', ...yAxisCols],
        topEvents: '2',
        orderby: yAxisCols[0],
        yAxis: yAxisCols,
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

  if (isReleasesLoading) {
    return <LoadingContainer />;
  }

  function renderCharts() {
    const transformedSeries: {[yAxisName: string]: Series[]} = {};
    yAxes.forEach(val => (transformedSeries[YAXIS_COLUMNS[val]] = []));

    if (defined(releaseSeries)) {
      Object.keys(releaseSeries).forEach((release, index) => {
        Object.keys(releaseSeries[release]).forEach(yAxis => {
          const label = `${release}`;
          if (yAxis in transformedSeries) {
            transformedSeries[yAxis].push({
              seriesName: label,
              color: CHART_PALETTE[1][index],
              data:
                releaseSeries[release][yAxis]?.data.map(datum => {
                  return {
                    name: datum[0] * 1000,
                    value: datum[1][0].count,
                  } as SeriesDataUnit;
                }) ?? [],
            });
          }
        });
      });
    }

    return (
      <Fragment>
        {yAxes.map((val, index) => {
          return (
            <ChartsContainerItem key={val}>
              <MiniChartPanel title={CHART_TITLES[val]}>
                <Chart
                  height={150}
                  data={transformedSeries[yAxisCols[index]]}
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
                  aggregateOutputFormat={OUTPUT_TYPE[val]}
                  tooltipFormatterOptions={{
                    valueFormatter: value =>
                      tooltipFormatterUsingAggregateOutputType(value, OUTPUT_TYPE[val]),
                  }}
                  errored={isError}
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
      <StyledRow minSize={300}>
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

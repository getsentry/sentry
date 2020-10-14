import React from 'react';
import {withRouter} from 'react-router';
import {WithRouterProps} from 'react-router/lib/withRouter';

import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import TransitionChart from 'app/components/charts/transitionChart';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import getDynamicText from 'app/utils/getDynamicText';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import {decodeScalar} from 'app/utils/queryString';
import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import EventView from 'app/utils/discover/eventView';
import {OrganizationSummary, EventsStatsData} from 'app/types';
import LineChart from 'app/components/charts/lineChart';
import ChartZoom from 'app/components/charts/chartZoom';
import {Series, SeriesDataUnit} from 'app/types/echarts';
import theme from 'app/utils/theme';
import {axisLabelFormatter, tooltipFormatter} from 'app/utils/discover/charts';

import {
  getCurrentTrendFunction,
  getIntervalRatio,
  movingAverage,
  trendToColor,
} from './utils';
import {TrendChangeType, TrendsStats, NormalizedTrendsTransaction} from './types';

const QUERY_KEYS = [
  'environment',
  'project',
  'query',
  'start',
  'end',
  'statsPeriod',
] as const;
const AVERAGE_WINDOW = 10;

type ViewProps = Pick<EventView, typeof QUERY_KEYS[number]>;

type Props = WithRouterProps &
  ViewProps & {
    api: Client;
    location: Location;
    organization: OrganizationSummary;
    trendChangeType: TrendChangeType;
    transaction?: NormalizedTrendsTransaction;
    isLoading: boolean;
    statsData: TrendsStats;
  };

function transformEventStats(data: EventsStatsData, seriesName?: string): Series[] {
  return [
    {
      seriesName: seriesName || 'Current',
      data: data.map(([timestamp, countsForTimestamp]) => ({
        name: timestamp * 1000,
        value: countsForTimestamp.reduce((acc, {count}) => acc + count, 0),
      })),
    },
  ];
}

function transformEventStatsSmoothed(data: Series[], seriesName?: string): Series[] {
  const currentData = data[0].data;
  const resultData: SeriesDataUnit[] = [];
  resultData.push(currentData[0]);

  // Start at 1 so we don't get NaN from the movingAverage
  for (let i = 1; i < currentData.length; i++) {
    let value;
    if (i < AVERAGE_WINDOW) {
      // A rougher movingAverage for these points, but this way there isn't a gap
      value = movingAverage(currentData, i, i);
    } else {
      value = movingAverage(currentData, i, AVERAGE_WINDOW);
    }
    resultData.push({
      name: currentData[i].name,
      value,
    });
  }
  return [
    {
      seriesName: 'smoothed ' + seriesName || 'Current',
      data: resultData,
    },
  ];
}

function getLegend() {
  const legend = {
    right: 10,
    top: 0,
    itemGap: 12,
    align: 'left',
    textStyle: {
      verticalAlign: 'top',
      fontSize: 11,
      fontFamily: 'Rubik',
    },
    data: [
      {
        name: 'Baseline',
        icon:
          'path://M180 1000 l0 -40 200 0 200 0 0 40 0 40 -200 0 -200 0 0 -40z, M810 1000 l0 -40 200 0 200 0 0 40 0 40 -200 0 -200 0 0 -40zm, M1440 1000 l0 -40 200 0 200 0 0 40 0 40 -200 0 -200 0 0 -40z',
      },
      {
        name: 'Releases',
        icon: 'line',
      },
    ],
  };
  return legend;
}

function getIntervalLine(
  series: Series[],
  intervalRatio: number,
  transaction?: NormalizedTrendsTransaction
) {
  if (!transaction || !series.length || !series[0].data || !series[0].data.length) {
    return [];
  }

  const seriesStart = parseInt(series[0].data[0].name as string, 0);
  const seriesEnd = parseInt(series[0].data.slice(-1)[0].name as string, 0);

  if (seriesEnd < seriesStart) {
    return [];
  }

  const periodLine = {
    data: [] as any[],
    color: theme.gray700,
    markLine: {
      data: [] as any[],
      label: {} as any,
      lineStyle: {
        normal: {
          color: theme.gray700,
          type: 'dashed',
          width: 1,
        },
      },
      symbol: ['none', 'none'],
      tooltip: {
        show: false,
      },
    },
    seriesName: 'Baseline',
  };

  const periodLineLabel = {
    fontSize: 11,
    show: true,
  };

  const previousPeriod = {
    ...periodLine,
    markLine: {...periodLine.markLine},
    seriesName: 'Baseline',
  };
  const currentPeriod = {
    ...periodLine,
    markLine: {...periodLine.markLine},
    seriesName: 'Baseline',
  };
  const periodDividingLine = {
    ...periodLine,
    markLine: {...periodLine.markLine},
    seriesName: 'Period split',
  };

  const seriesDiff = seriesEnd - seriesStart;
  const seriesLine = seriesDiff * (intervalRatio || 0.5) + seriesStart;

  previousPeriod.markLine.data = [
    [
      {value: 'Past', coord: [seriesStart, transaction.aggregate_range_1]},
      {coord: [seriesLine, transaction.aggregate_range_1]},
    ],
  ];
  currentPeriod.markLine.data = [
    [
      {value: 'Present', coord: [seriesLine, transaction.aggregate_range_2]},
      {coord: [seriesEnd, transaction.aggregate_range_2]},
    ],
  ];
  periodDividingLine.markLine = {
    data: [
      {
        value: 'Previous Period / This Period',
        xAxis: seriesLine,
      },
    ],
    label: {show: false},
    lineStyle: {
      normal: {
        color: theme.gray700,
        type: 'solid',
        width: 2,
      },
    },
    symbol: ['none', 'none'],
    tooltip: {
      show: false,
    },
  };

  previousPeriod.markLine.label = {
    ...periodLineLabel,
    formatter: 'Past',
    position: 'insideStartBottom',
  };
  currentPeriod.markLine.label = {
    ...periodLineLabel,
    formatter: 'Present',
    position: 'insideEndBottom',
  };

  const additionalLineSeries = [previousPeriod, currentPeriod, periodDividingLine];
  return additionalLineSeries;
}

class Chart extends React.Component<Props> {
  render() {
    const props = this.props;

    const {
      trendChangeType,
      router,
      statsPeriod,
      project,
      environment,
      transaction,
      statsData,
      isLoading,
      location,
    } = props;
    const lineColor = trendToColor[trendChangeType];

    const events =
      statsData && transaction?.project && transaction?.transaction
        ? statsData[[transaction.project, transaction.transaction].join(',')]
        : undefined;
    const data = events?.data ?? [];

    const trendFunction = getCurrentTrendFunction(location);
    const results = transformEventStats(data, trendFunction.chartLabel);
    const smoothedResults = transformEventStatsSmoothed(
      results,
      trendFunction.chartLabel
    );

    const start = props.start ? getUtcToLocalDateObject(props.start) : undefined;

    const end = props.end ? getUtcToLocalDateObject(props.end) : undefined;
    const utc = decodeScalar(router.location.query.utc);

    const intervalRatio = getIntervalRatio(router.location);
    const legend = getLegend();

    const loading = isLoading;
    const reloading = isLoading;

    const chartOptions = {
      tooltip: {
        valueFormatter: (value, seriesName) => {
          return tooltipFormatter(value, seriesName.replace('smoothed ', ''));
        },
      },
      yAxis: {
        axisLabel: {
          color: theme.gray400,
          // p50() coerces the axis to be time based
          formatter: (value: number) => axisLabelFormatter(value, 'p50()'),
        },
      },
    };

    return (
      <React.Fragment>
        <ChartZoom
          router={router}
          period={statsPeriod}
          projects={project}
          environments={environment}
        >
          {zoomRenderProps => {
            const smoothedSeries = smoothedResults
              ? smoothedResults
                  .map(values => {
                    return {
                      ...values,
                      color: lineColor,
                      lineStyle: {
                        opacity: 1,
                      },
                    };
                  })
                  .reverse()
              : [];

            const series = results
              ? results
                  .map(values => {
                    return {
                      ...values,
                      color: lineColor,
                      lineStyle: {
                        opacity: 0.25,
                      },
                    };
                  })
                  .reverse()
              : [];

            const intervalSeries = getIntervalLine(series, intervalRatio, transaction);

            return (
              <ReleaseSeries
                start={start}
                end={end}
                period={statsPeriod}
                utc={utc}
                projects={project}
                environments={environment}
              >
                {({releaseSeries}) => (
                  <TransitionChart loading={loading} reloading={reloading}>
                    <TransparentLoadingMask visible={reloading} />
                    {getDynamicText({
                      value: (
                        <LineChart
                          {...zoomRenderProps}
                          {...chartOptions}
                          series={[
                            ...smoothedSeries,
                            ...series,
                            ...releaseSeries,
                            ...intervalSeries,
                          ]}
                          seriesOptions={{
                            showSymbol: false,
                          }}
                          legend={legend}
                          toolBox={{
                            show: false,
                          }}
                          grid={{
                            left: '10px',
                            right: '10px',
                            top: '40px',
                            bottom: '0px',
                          }}
                        />
                      ),
                      fixed: 'Duration Chart',
                    })}
                  </TransitionChart>
                )}
              </ReleaseSeries>
            );
          }}
        </ChartZoom>
      </React.Fragment>
    );
  }
}

export default withApi(withRouter(Chart));

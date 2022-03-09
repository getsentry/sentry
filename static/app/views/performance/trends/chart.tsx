import {browserHistory, withRouter, WithRouterProps} from 'react-router';
import {useTheme} from '@emotion/react';
import type {LegendComponentOption} from 'echarts';

import ChartZoom from 'sentry/components/charts/chartZoom';
import LineChart, {LineChartSeries} from 'sentry/components/charts/lineChart';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import {EventsStatsData, OrganizationSummary, Project} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
import getDynamicText from 'sentry/utils/getDynamicText';
import {decodeList} from 'sentry/utils/queryString';
import {Theme} from 'sentry/utils/theme';

import {ViewProps} from '../types';

import {
  NormalizedTrendsTransaction,
  TrendChangeType,
  TrendFunctionField,
  TrendsStats,
} from './types';
import {
  generateTrendFunctionAsString,
  getCurrentTrendFunction,
  getCurrentTrendParameter,
  getUnselectedSeries,
  transformEventStatsSmoothed,
  trendToColor,
} from './utils';

type Props = WithRouterProps &
  ViewProps & {
    isLoading: boolean;
    location: Location;
    organization: OrganizationSummary;
    projects: Project[];
    statsData: TrendsStats;
    trendChangeType: TrendChangeType;
    disableLegend?: boolean;
    disableXAxis?: boolean;
    grid?: React.ComponentProps<typeof LineChart>['grid'];
    height?: number;
    transaction?: NormalizedTrendsTransaction;
    trendFunctionField?: TrendFunctionField;
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

function getLegend(trendFunction: string): LegendComponentOption {
  return {
    right: 10,
    top: 0,
    itemGap: 12,
    align: 'left',
    data: [
      {
        name: 'Baseline',
        icon: 'path://M180 1000 l0 -40 200 0 200 0 0 40 0 40 -200 0 -200 0 0 -40z, M810 1000 l0 -40 200 0 200 0 0 40 0 40 -200 0 -200 0 0 -40zm, M1440 1000 l0 -40 200 0 200 0 0 40 0 40 -200 0 -200 0 0 -40z',
      },
      {
        name: 'Releases',
      },
      {
        name: trendFunction,
      },
    ],
  };
}

function getIntervalLine(
  theme: Theme,
  series: Series[],
  intervalRatio: number,
  transaction?: NormalizedTrendsTransaction
): LineChartSeries[] {
  if (!transaction || !series.length || !series[0].data || !series[0].data.length) {
    return [];
  }

  const seriesStart = parseInt(series[0].data[0].name as string, 0);
  const seriesEnd = parseInt(series[0].data.slice(-1)[0].name as string, 0);

  if (seriesEnd < seriesStart) {
    return [];
  }

  const periodLine: LineChartSeries = {
    data: [],
    color: theme.textColor,
    markLine: {
      data: [],
      label: {},
      lineStyle: {
        color: theme.textColor,
        type: 'dashed',
        width: 1,
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
    color: theme.textColor,
    silent: true,
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
  const seriesLine = seriesDiff * intervalRatio + seriesStart;

  previousPeriod.markLine.data = [
    [
      {value: 'Past', coord: [seriesStart, transaction.aggregate_range_1]},
      {coord: [seriesLine, transaction.aggregate_range_1]},
    ],
  ];
  previousPeriod.markLine.tooltip = {
    formatter: () => {
      return [
        '<div class="tooltip-series tooltip-series-solo">',
        '<div>',
        `<span class="tooltip-label"><strong>${t('Past Baseline')}</strong></span>`,
        // p50() coerces the axis to be time based
        tooltipFormatter(transaction.aggregate_range_1, 'p50()'),
        '</div>',
        '</div>',
        '<div class="tooltip-arrow"></div>',
      ].join('');
    },
  };
  currentPeriod.markLine.data = [
    [
      {value: 'Present', coord: [seriesLine, transaction.aggregate_range_2]},
      {coord: [seriesEnd, transaction.aggregate_range_2]},
    ],
  ];
  currentPeriod.markLine.tooltip = {
    formatter: () => {
      return [
        '<div class="tooltip-series tooltip-series-solo">',
        '<div>',
        `<span class="tooltip-label"><strong>${t('Present Baseline')}</strong></span>`,
        // p50() coerces the axis to be time based
        tooltipFormatter(transaction.aggregate_range_2, 'p50()'),
        '</div>',
        '</div>',
        '<div class="tooltip-arrow"></div>',
      ].join('');
    },
  };
  periodDividingLine.markLine = {
    data: [
      {
        xAxis: seriesLine,
      },
    ],
    label: {show: false},
    lineStyle: {
      color: theme.textColor,
      type: 'solid',
      width: 2,
    },
    symbol: ['none', 'none'],
    tooltip: {
      show: false,
    },
    silent: true,
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

export function Chart({
  trendChangeType,
  router,
  statsPeriod,
  transaction,
  statsData,
  isLoading,
  location,
  start: propsStart,
  end: propsEnd,
  trendFunctionField,
  disableXAxis,
  disableLegend,
  grid,
  height,
  projects,
  project,
}: Props) {
  const theme = useTheme();

  const handleLegendSelectChanged = legendChange => {
    const {selected} = legendChange;
    const unselected = Object.keys(selected).filter(key => !selected[key]);

    const query = {
      ...location.query,
    };

    const queryKey = getUnselectedSeries(trendChangeType);
    query[queryKey] = unselected;

    const to = {
      ...location,
      query,
    };
    browserHistory.push(to);
  };

  const lineColor = trendToColor[trendChangeType || ''];

  const events =
    statsData && transaction?.project && transaction?.transaction
      ? statsData[[transaction.project, transaction.transaction].join(',')]
      : undefined;
  const data = events?.data ?? [];

  const trendFunction = getCurrentTrendFunction(location, trendFunctionField);
  const trendParameter = getCurrentTrendParameter(location, projects, project);
  const chartLabel = generateTrendFunctionAsString(
    trendFunction.field,
    trendParameter.column
  );
  const results = transformEventStats(data, chartLabel);
  const {smoothedResults, minValue, maxValue} = transformEventStatsSmoothed(
    results,
    chartLabel
  );

  const start = propsStart ? getUtcToLocalDateObject(propsStart) : null;
  const end = propsEnd ? getUtcToLocalDateObject(propsEnd) : null;
  const {utc} = normalizeDateTimeParams(location.query);

  const seriesSelection = decodeList(
    location.query[getUnselectedSeries(trendChangeType)]
  ).reduce((selection, metric) => {
    selection[metric] = false;
    return selection;
  }, {});
  const legend: LegendComponentOption = disableLegend
    ? {show: false}
    : {
        ...getLegend(chartLabel),
        selected: seriesSelection,
      };

  const loading = isLoading;
  const reloading = isLoading;

  const yMax = Math.max(
    maxValue,
    transaction?.aggregate_range_2 || 0,
    transaction?.aggregate_range_1 || 0
  );
  const yMin = Math.min(
    minValue,
    transaction?.aggregate_range_1 || Number.MAX_SAFE_INTEGER,
    transaction?.aggregate_range_2 || Number.MAX_SAFE_INTEGER
  );
  const yDiff = yMax - yMin;
  const yMargin = yDiff * 0.1;

  const chartOptions = {
    tooltip: {
      valueFormatter: (value, seriesName) => {
        return tooltipFormatter(value, seriesName);
      },
    },
    yAxis: {
      min: Math.max(0, yMin - yMargin),
      max: yMax + yMargin,
      axisLabel: {
        color: theme.chartLabel,
        // p50() coerces the axis to be time based
        formatter: (value: number) => axisLabelFormatter(value, 'p50()'),
      },
    },
  };

  return (
    <ChartZoom
      router={router}
      period={statsPeriod}
      start={start}
      end={end}
      utc={utc === 'true'}
    >
      {zoomRenderProps => {
        const smoothedSeries = smoothedResults
          ? smoothedResults.map(values => {
              return {
                ...values,
                color: lineColor.default,
                lineStyle: {
                  opacity: 1,
                },
              };
            })
          : [];

        const intervalSeries = getIntervalLine(
          theme,
          smoothedResults || [],
          0.5,
          transaction
        );

        return (
          <TransitionChart loading={loading} reloading={reloading}>
            <TransparentLoadingMask visible={reloading} />
            {getDynamicText({
              value: (
                <LineChart
                  height={height}
                  {...zoomRenderProps}
                  {...chartOptions}
                  onLegendSelectChanged={handleLegendSelectChanged}
                  series={[...smoothedSeries, ...intervalSeries]}
                  seriesOptions={{
                    showSymbol: false,
                  }}
                  legend={legend}
                  toolBox={{
                    show: false,
                  }}
                  grid={
                    grid ?? {
                      left: '10px',
                      right: '10px',
                      top: '40px',
                      bottom: '0px',
                    }
                  }
                  xAxis={disableXAxis ? {show: false} : undefined}
                />
              ),
              fixed: 'Duration Chart',
            })}
          </TransitionChart>
        );
      }}
    </ChartZoom>
  );
}

export default withRouter(Chart);

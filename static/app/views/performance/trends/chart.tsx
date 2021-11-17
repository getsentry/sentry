import {browserHistory, withRouter, WithRouterProps} from 'react-router';
import {useTheme} from '@emotion/react';

import ChartZoom from 'app/components/charts/chartZoom';
import LineChart from 'app/components/charts/lineChart';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {t} from 'app/locale';
import {EventsStatsData, OrganizationSummary, Project} from 'app/types';
import {Series} from 'app/types/echarts';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import {axisLabelFormatter, tooltipFormatter} from 'app/utils/discover/charts';
import EventView from 'app/utils/discover/eventView';
import getDynamicText from 'app/utils/getDynamicText';
import {decodeList} from 'app/utils/queryString';
import {Theme} from 'app/utils/theme';

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

const QUERY_KEYS = [
  'environment',
  'project',
  'query',
  'start',
  'end',
  'statsPeriod',
] as const;

type ViewProps = Pick<EventView, typeof QUERY_KEYS[number]>;

type Props = WithRouterProps &
  ViewProps & {
    location: Location;
    organization: OrganizationSummary;
    trendChangeType: TrendChangeType;
    trendFunctionField?: TrendFunctionField;
    transaction?: NormalizedTrendsTransaction;
    isLoading: boolean;
    statsData: TrendsStats;
    projects: Project[];
    height?: number;
    grid?: LineChart['props']['grid'];
    disableXAxis?: boolean;
    disableLegend?: boolean;
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

function getLegend(trendFunction: string) {
  return {
    right: 10,
    top: 0,
    itemGap: 12,
    align: 'left' as const,
    data: [
      {
        name: 'Baseline',
        icon: 'path://M180 1000 l0 -40 200 0 200 0 0 40 0 40 -200 0 -200 0 0 -40z, M810 1000 l0 -40 200 0 200 0 0 40 0 40 -200 0 -200 0 0 -40zm, M1440 1000 l0 -40 200 0 200 0 0 40 0 40 -200 0 -200 0 0 -40z',
      },
      {
        name: 'Releases',
        icon: 'line',
      },
      {
        name: trendFunction,
        icon: 'line',
      },
    ],
  };
}

function getIntervalLine(
  theme: Theme,
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
    color: theme.textColor,
    markLine: {
      data: [] as any[],
      label: {} as any,
      lineStyle: {
        normal: {
          color: theme.textColor,
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
  } as any;
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
  } as any;
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
        color: theme.textColor,
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
  const trendParameter = getCurrentTrendParameter(location);
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
  const {utc} = getParams(location.query);

  const seriesSelection = decodeList(
    location.query[getUnselectedSeries(trendChangeType)]
  ).reduce((selection, metric) => {
    selection[metric] = false;
    return selection;
  }, {});
  const legend = disableLegend
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

import type {Theme} from '@emotion/react';

import MarkArea from 'sentry/components/charts/components/markArea';
import MarkLine from 'sentry/components/charts/components/markLine';
import type {LineChartSeries} from 'sentry/components/charts/lineChart';
import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import {tooltipFormatter} from 'sentry/utils/discover/charts';
import type {NormalizedTrendsTransaction} from 'sentry/views/performance/trends/types';
import {getPerformanceDuration} from 'sentry/views/performance/utils/getPerformanceDuration';
import transformTransaction from 'sentry/views/performance/utils/transformTransaction';

const DEFAULT_CHART_HEIGHT = 200;
const X_AXIS_MARGIN_OFFSET = 23;

export function getIntervalLine(
  theme: Theme,
  series: Series[],
  intervalRatio: number,
  label: boolean,
  transaction?: NormalizedTrendsTransaction,
  useRegressionFormat?: boolean
): LineChartSeries[] {
  if (!transaction || !series.length || !series[0]!.data || !series[0]!.data.length) {
    return [];
  }

  const transformedTransaction = transformTransaction(transaction);

  const seriesStart = parseInt(series[0]!.data[0]!.name as string, 10);
  const seriesEnd = parseInt(series[0]!.data.slice(-1)[0]!.name as string, 10);

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
        width: label ? 1 : 2,
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
    show: label,
    color: theme.textColor,
    silent: label,
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
    seriesName: 'Baseline',
  };

  const seriesDiff = seriesEnd - seriesStart;
  const seriesLine = seriesDiff * intervalRatio + seriesStart;
  const {breakpoint} = transformedTransaction;

  const divider = breakpoint || seriesLine;

  previousPeriod.markLine.data = [
    [
      {value: 'Past', coord: [seriesStart, transformedTransaction.aggregate_range_1]},
      {coord: [divider, transformedTransaction.aggregate_range_1]},
    ],
  ];
  previousPeriod.markLine.tooltip = {
    formatter: () => {
      return [
        '<div class="tooltip-series tooltip-series-solo">',
        '<div>',
        `<span class="tooltip-label"><strong>${t('Past Baseline')}</strong></span>`,
        // p50() coerces the axis to be time based
        tooltipFormatter(transformedTransaction.aggregate_range_1, 'duration'),
        '</div>',
        '</div>',
        '<div class="tooltip-arrow"></div>',
      ].join('');
    },
  };
  currentPeriod.markLine.data = [
    [
      {value: 'Present', coord: [divider, transformedTransaction.aggregate_range_2]},
      {coord: [seriesEnd, transformedTransaction.aggregate_range_2]},
    ],
  ];
  currentPeriod.markLine.tooltip = {
    formatter: () => {
      return [
        '<div class="tooltip-series tooltip-series-solo">',
        '<div>',
        `<span class="tooltip-label"><strong>${t('Present Baseline')}</strong></span>`,
        // p50() coerces the axis to be time based
        tooltipFormatter(transformedTransaction.aggregate_range_2, 'duration'),
        '</div>',
        '</div>',
        '<div class="tooltip-arrow"></div>',
      ].join('');
    },
  };
  periodDividingLine.markLine = {
    data: [
      {
        xAxis: divider,
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

  // Apply new styles for statistical detector regression issue
  if (useRegressionFormat) {
    previousPeriod.markLine.label = {
      ...periodLineLabel,
      formatter: `Baseline ${getPerformanceDuration(
        transformedTransaction.aggregate_range_1
      )}`,
      position: 'insideStartBottom',
    };

    periodDividingLine.markLine.lineStyle = {
      ...periodDividingLine.markLine.lineStyle,
      color: theme.red300,
    };

    currentPeriod.markLine.lineStyle = {
      ...currentPeriod.markLine.lineStyle,
      color: theme.red300,
    };

    currentPeriod.markLine.label = {
      ...periodLineLabel,
      formatter: `Regressed ${getPerformanceDuration(
        transformedTransaction.aggregate_range_2
      )}`,
      position: 'insideEndTop',
      color: theme.gray400,
    };

    additionalLineSeries.push({
      seriesName: 'Regression Area',
      markLine: {},
      markArea: MarkArea({
        silent: true,
        itemStyle: {
          color: theme.red300,
          opacity: 0.2,
        },
        data: [
          [
            {
              xAxis: divider,
            },
            {xAxis: seriesEnd},
          ],
        ],
      }),
      data: [],
    });

    additionalLineSeries.push({
      seriesName: 'Baseline Axis Line',
      type: 'line',
      markLine:
        MarkLine({
          silent: true,
          label: {
            show: false,
          },
          lineStyle: {color: theme.green400, type: 'solid', width: 4},
          data: [
            // The line needs to be hard-coded to a pixel coordinate because
            // the lowest y-value is dynamic and 'min' doesn't work here
            [
              {xAxis: 'min', y: DEFAULT_CHART_HEIGHT - X_AXIS_MARGIN_OFFSET},
              {xAxis: breakpoint, y: DEFAULT_CHART_HEIGHT - X_AXIS_MARGIN_OFFSET},
            ],
          ],
        }) ?? {},
      data: [],
    });

    additionalLineSeries.push({
      seriesName: 'Regression Axis Line',
      type: 'line',
      markLine:
        MarkLine({
          silent: true,
          label: {
            show: false,
          },
          lineStyle: {color: theme.red300, type: 'solid', width: 4},
          data: [
            // The line needs to be hard-coded to a pixel coordinate because
            // the lowest y-value is dynamic and 'min' doesn't work here
            [
              {xAxis: breakpoint, y: DEFAULT_CHART_HEIGHT - X_AXIS_MARGIN_OFFSET},
              {xAxis: 'max', y: DEFAULT_CHART_HEIGHT - X_AXIS_MARGIN_OFFSET},
            ],
          ],
        }) ?? {},
      data: [],
    });
  }

  return additionalLineSeries;
}

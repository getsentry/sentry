import {Theme} from '@emotion/react';

import {LineChartSeries} from 'sentry/components/charts/lineChart';
import {t} from 'sentry/locale';
import {Series} from 'sentry/types/echarts';
import {tooltipFormatter} from 'sentry/utils/discover/charts';
import {NormalizedTrendsTransaction} from 'sentry/views/performance/trends/types';

function transformTransaction(
  transaction: NormalizedTrendsTransaction
): NormalizedTrendsTransaction {
  if (transaction && transaction.breakpoint) {
    return {
      ...transaction,
      breakpoint: transaction.breakpoint * 1000,
    };
  }
  return transaction;
}

export function getIntervalLine(
  theme: Theme,
  series: Series[],
  intervalRatio: number,
  transaction?: NormalizedTrendsTransaction
): LineChartSeries[] {
  if (!transaction || !series.length || !series[0].data || !series[0].data.length) {
    return [];
  }

  const transformedTransaction = transformTransaction(transaction);

  const seriesStart = parseInt(series[0].data[0].name as string, 10);
  const seriesEnd = parseInt(series[0].data.slice(-1)[0].name as string, 10);

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
        width: 2,
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
    show: false,
    color: theme.textColor,
    silent: false,
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
  return additionalLineSeries;
}

import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import BaseChart from 'sentry/components/charts/baseChart';
import {t} from 'sentry/locale';
import {Project} from 'sentry/types';
import {axisLabelFormatter} from 'sentry/utils/discover/charts';

import NoEvents from './noEvents';

type BaseChartProps = React.ComponentProps<typeof BaseChart>;

type Props = {
  firstEvent: boolean;
  stats: Project['stats'];
  transactionStats?: Project['transactionStats'];
};

function Chart({firstEvent, stats, transactionStats}: Props) {
  const series: BaseChartProps['series'] = [];
  const hasTransactions = transactionStats !== undefined;

  const theme = useTheme();

  if (transactionStats) {
    const transactionSeries = transactionStats.map(([timestamp, value]) => [
      timestamp * 1000,
      value,
    ]);

    series.push({
      cursor: 'normal' as const,
      name: t('Transactions'),
      type: 'bar',
      data: transactionSeries,
      barMinHeight: 1,
      xAxisIndex: 1,
      yAxisIndex: 1,
      itemStyle: {
        color: theme.gray200,
        opacity: 0.8,
      },
      emphasis: {
        itemStyle: {
          color: theme.gray200,
          opacity: 1.0,
        },
      },
    });
  }

  if (stats) {
    series.push({
      cursor: 'normal' as const,
      name: t('Errors'),
      type: 'bar',
      data: stats.map(([timestamp, value]) => [timestamp * 1000, value]),
      barMinHeight: 1,
      xAxisIndex: 0,
      yAxisIndex: 0,
      itemStyle: {
        color: theme.purple300,
        opacity: 0.6,
      },
      emphasis: {
        itemStyle: {
          color: theme.purple300,
          opacity: 0.8,
        },
      },
    });
  }
  const grid = hasTransactions
    ? [
        {
          top: 10,
          bottom: 60,
          left: 2,
          right: 2,
        },
        {
          top: 105,
          bottom: 0,
          left: 2,
          right: 2,
        },
      ]
    : [
        {
          top: 10,
          bottom: 0,
          left: 2,
          right: 2,
        },
      ];

  const chartOptions = {
    series,
    colors: [],
    height: 150,
    isGroupedByDate: true,
    showTimeInTooltip: true,
    grid,
    tooltip: {
      trigger: 'axis' as const,
    },
    xAxes: Array.from(new Array(series.length)).map((_i, index) => ({
      gridIndex: index,
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        show: false,
      },
      axisPointer: {
        type: 'line' as const,
        label: {
          show: false,
        },
        lineStyle: {
          width: 0,
        },
      },
    })),
    yAxes: Array.from(new Array(series.length)).map((_i, index) => ({
      gridIndex: index,
      interval: Infinity,
      max(value: {max: number}) {
        // This keeps small datasets from looking 'scary'
        // by having full bars for < 10 values.
        return Math.max(10, value.max);
      },
      axisLabel: {
        margin: 2,
        showMaxLabel: true,
        showMinLabel: false,
        color: theme.chartLabel,
        fontFamily: theme.text.family,
        inside: true,
        lineHeight: 12,
        formatter: (value: number) => axisLabelFormatter(value, 'number', true),
        textBorderColor: theme.backgroundSecondary,
        textBorderWidth: 1,
      },
      splitLine: {
        show: false,
      },
      zlevel: theme.zIndex.header,
    })),
    axisPointer: {
      // Link each x-axis together.
      link: [{xAxisIndex: [0, 1]}],
    },
    options: {
      animation: false,
    },
  };

  return (
    <Fragment>
      <BaseChart {...chartOptions} />
      {!firstEvent && <NoEvents seriesCount={series.length} />}
    </Fragment>
  );
}

export default Chart;

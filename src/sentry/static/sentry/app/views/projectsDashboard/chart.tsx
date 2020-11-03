import React from 'react';

import {Project} from 'app/types';
import {t} from 'app/locale';
import BaseChart from 'app/components/charts/baseChart';
import theme from 'app/utils/theme';
import {axisLabelFormatter} from 'app/utils/discover/charts';

import NoEvents from './noEvents';

type BaseChartProps = React.ComponentProps<typeof BaseChart>;

type Props = {
  firstEvent: boolean;
  stats: Project['stats'];
  transactionStats?: Project['transactionStats'];
};

const Chart = ({firstEvent, stats, transactionStats}: Props) => {
  const series: BaseChartProps['series'] = [];
  const hasTransactions = transactionStats !== undefined;

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
        color: theme.gray400,
        opacity: 0.8,
        emphasis: {
          color: theme.gray400,
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
        color: theme.purple500,
        opacity: 0.6,
        emphasis: {
          color: theme.purple500,
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
      boundaryGap: true,
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
        color: theme.gray400,
        fontFamily: theme.text.family,
        inside: true,
        lineHeight: 12,
        formatter: (value: number) => axisLabelFormatter(value, 'count()', true),
        textBorderColor: theme.gray100,
        textBorderWidth: 1,
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
    <React.Fragment>
      <BaseChart {...chartOptions} />
      {!firstEvent && <NoEvents seriesCount={series.length} />}
    </React.Fragment>
  );
};

export default Chart;

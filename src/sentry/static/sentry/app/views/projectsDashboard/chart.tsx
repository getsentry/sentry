import React from 'react';

import {Project} from 'app/types';
import {t} from 'app/locale';
import BaseChart from 'app/components/charts/baseChart';
import theme from 'app/utils/theme';

type BaseChartProps = React.ComponentProps<typeof BaseChart>;

type Props = {
  stats: Project['stats'];
  transactionStats?: Project['transactionStats'];
};

const Chart = ({stats, transactionStats}: Props) => {
  const series: BaseChartProps['series'] = [];
  let hasTransactions = false;

  if (transactionStats) {
    const transactionSeries = transactionStats.map(([timestamp, value]) => {
      if (value > 0) {
        hasTransactions = true;
      }
      return [timestamp * 1000, value];
    });
    if (hasTransactions) {
      series.push({
        cursor: 'normal' as const,
        name: t('Transactions'),
        type: 'bar',
        data: transactionSeries,
        xAxisIndex: 0,
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
  }

  if (stats) {
    series.push({
      cursor: 'normal' as const,
      name: t('Errors'),
      type: 'bar',
      data: stats.map(([timestamp, value]) => [timestamp * 1000, value]),
      barMinHeight: 1,
      barGap: '-100%',
      xAxisIndex: 0,
      yAxisIndex: 0,
      itemStyle: {
        color: theme.purple400,
        opacity: 0.6,
        emphasis: {
          color: theme.purple400,
          opacity: 0.8,
        },
      },
    });
  }

  const chartOptions = {
    series,
    colors: [],
    height: 120,
    isGroupedByDate: true,
    showTimeInTooltip: true,
    grid: {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    },
    tooltip: {
      trigger: 'axis' as const,
    },
    xAxis: {
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
    },
    yAxes: [
      {
        axisLabel: {
          show: false,
        },
      },
      {
        axisLabel: {
          show: false,
        },
      },
    ],
    options: {
      animation: false,
    },
  };

  return <BaseChart {...chartOptions} />;
};

export default Chart;

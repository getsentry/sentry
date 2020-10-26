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

  if (transactionStats) {
    series.push({
      cursor: 'normal' as const,
      name: t('Transactions'),
      type: 'bar',
      data: transactionStats.map(([timestamp, value]) => [timestamp * 1000, value]),
      itemStyle: {
        color: theme.gray300,
        opacity: 0.8,
        emphasis: {
          color: theme.gray300,
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
      barGap: '-100%',
      itemStyle: {
        color: theme.purple500,
        opacity: 0.8,
        emphasis: {
          color: theme.purple500,
          opacity: 1.0,
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
      // Fiddly values to give room for the axis name and breathing room
      // for the axis line.
      top: 2,
      bottom: 1,
      left: 20,
      right: 3,
    },
    tooltip: {
      trigger: 'axis' as const,
    },
    xAxis: {
      boundaryGap: true,
      axisLine: {
        show: true,
        lineStyle: {
          color: theme.chartLabel,
          opacity: 0.8,
        },
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
    yAxis: {
      show: true,
      name: 'log',
      nameGap: 3,
      nameLocation: 'middle' as const,
      nameTextStyle: {
        color: theme.gray400,
      },
      type: 'log' as const,
      min: 1,
      axisLabel: {
        show: false,
      },
    },
    options: {
      animation: false,
    },
  };

  return <BaseChart {...chartOptions} />;
};

export default Chart;

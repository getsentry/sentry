import type {Theme} from '@emotion/react';

import VisualMap from 'sentry/components/charts/components/visualMap';
import type {LineChart as EChartsLineChart} from 'sentry/components/charts/lineChart';
import type {Series} from 'sentry/types/echarts';
import {
  axisLabelFormatter,
  getDurationUnit,
  tooltipFormatter,
} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import type {NormalizedTrendsTransaction} from 'sentry/views/performance/trends/types';
import {getIntervalLine} from 'sentry/views/performance/utils';

export type EventBreakpointChartData = {
  evidenceData: NormalizedTrendsTransaction;
  percentileSeries: Series[];
};

function getBreakpointChartOptionsFromData(
  {percentileSeries, evidenceData}: EventBreakpointChartData,
  theme: Theme
) {
  const intervalSeries = getIntervalLine(
    theme,
    percentileSeries,
    0.5,
    true,
    evidenceData,
    true
  );

  const series = [...percentileSeries, ...intervalSeries];

  const legend = {
    right: 16,
    top: 12,
    data: percentileSeries.map(s => s.seriesName),
  };

  const durationUnit = getDurationUnit(series);

  const chartOptions: Omit<React.ComponentProps<typeof EChartsLineChart>, 'series'> = {
    axisPointer: {
      link: [
        {
          xAxisIndex: [0, 1],
          yAxisIndex: [0, 1],
        },
      ],
    },
    colors: [theme.gray200, theme.gray500],
    grid: {
      top: '40px',
      bottom: '0px',
    },
    legend,
    toolBox: {show: false},
    tooltip: {
      valueFormatter: (value, seriesName) => {
        return tooltipFormatter(value, aggregateOutputType(seriesName));
      },
    },
    xAxis: {type: 'time'},
    yAxis: {
      minInterval: durationUnit,
      axisLabel: {
        color: theme.chartLabel,
        formatter: (value: number) =>
          axisLabelFormatter(value, 'duration', undefined, durationUnit),
      },
    },
    options: {
      visualMap: VisualMap({
        show: false,
        type: 'piecewise',
        selectedMode: false,
        dimension: 0,
        pieces: [
          {
            gte: 0,
            lt: evidenceData?.breakpoint ? evidenceData.breakpoint * 1000 : 0,
            color: theme.gray500,
          },
          {
            gte: evidenceData?.breakpoint ? evidenceData.breakpoint * 1000 : 0,
            color: theme.red300,
          },
        ],
      }),
    },
  };
  return {
    series,
    chartOptions,
  };
}

export default getBreakpointChartOptionsFromData;

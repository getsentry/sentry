import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import ChartZoom from 'sentry/components/charts/chartZoom';
import VisualMap from 'sentry/components/charts/components/visualMap';
import {LineChart as EChartsLineChart} from 'sentry/components/charts/lineChart';
import {PageFilters} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {
  axisLabelFormatter,
  getDurationUnit,
  tooltipFormatter,
} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import useRouter from 'sentry/utils/useRouter';
import {NormalizedTrendsTransaction} from 'sentry/views/performance/trends/types';
import {getIntervalLine} from 'sentry/views/performance/utils';

interface ChartProps {
  datetime: PageFilters['datetime'];
  evidenceData: NormalizedTrendsTransaction;
  percentileSeries: Series[];
}

function LineChart({datetime, percentileSeries, evidenceData}: ChartProps) {
  const theme = useTheme();
  const router = useRouter();

  const series = useMemo(() => {
    const intervalSeries = getIntervalLine(
      theme,
      percentileSeries,
      0.5,
      true,
      evidenceData,
      true
    );
    return [...percentileSeries, ...intervalSeries];
  }, [percentileSeries, evidenceData, theme]);

  const chartOptions: Omit<
    React.ComponentProps<typeof EChartsLineChart>,
    'series'
  > = useMemo(() => {
    const legend = {
      right: 16,
      top: 12,
      data: percentileSeries.map(s => s.seriesName),
    };

    const durationUnit = getDurationUnit(series);

    return {
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
  }, [series, theme, percentileSeries, evidenceData.breakpoint]);

  return (
    <ChartZoom router={router} {...datetime}>
      {zoomRenderProps => (
        <EChartsLineChart {...zoomRenderProps} {...chartOptions} series={series} />
      )}
    </ChartZoom>
  );
}

export default LineChart;

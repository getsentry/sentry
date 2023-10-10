import {useTheme} from '@emotion/react';

import ChartZoom from 'sentry/components/charts/chartZoom';
import {
  LineChart as EchartsLineChart,
  LineChartProps,
} from 'sentry/components/charts/lineChart';
import {EventsStatsData} from 'sentry/types';
import {getUserTimezone} from 'sentry/utils/dates';
import {
  axisLabelFormatter,
  getDurationUnit,
  tooltipFormatter,
} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import useRouter from 'sentry/utils/useRouter';
import {transformEventStats} from 'sentry/views/performance/trends/chart';
import {
  NormalizedTrendsTransaction,
  TrendChangeType,
} from 'sentry/views/performance/trends/types';
import {trendToColor} from 'sentry/views/performance/trends/utils';
import {getIntervalLine} from 'sentry/views/performance/utils';

interface ChartProps {
  chartLabel: string;
  end: string;
  evidenceData: NormalizedTrendsTransaction;
  start: string;
  statsData: EventsStatsData;
}

function LineChart({statsData, evidenceData, start, end, chartLabel}: ChartProps) {
  const theme = useTheme();
  const router = useRouter();

  const resultSeries = transformEventStats(statsData, chartLabel).map(values => {
    return {
      ...values,
      color: trendToColor[TrendChangeType.REGRESSION].default,
      lineStyle: {
        opacity: 1,
      },
    };
  });

  const needsLabel = true;
  const intervalSeries = getIntervalLine(
    theme,
    resultSeries || [],
    0.5,
    needsLabel,
    evidenceData,
    true
  );

  const series = [...resultSeries, ...intervalSeries];

  const durationUnit = getDurationUnit(series);

  const chartOptions: Omit<LineChartProps, 'series'> = {
    tooltip: {
      valueFormatter: (value, seriesName) => {
        return tooltipFormatter(value, aggregateOutputType(seriesName));
      },
    },
    yAxis: {
      minInterval: durationUnit,
      axisLabel: {
        color: theme.chartLabel,
        formatter: (value: number) =>
          axisLabelFormatter(value, 'duration', undefined, durationUnit),
      },
    },
  };

  return (
    <ChartZoom router={router} start={start} end={end} utc={getUserTimezone() === 'UTC'}>
      {zoomRenderProps => {
        return (
          <EchartsLineChart
            {...zoomRenderProps}
            {...chartOptions}
            series={series}
            seriesOptions={{
              showSymbol: false,
            }}
            toolBox={{
              show: false,
            }}
            grid={{
              left: '10px',
              right: '10px',
              top: '40px',
              bottom: '0px',
            }}
          />
        );
      }}
    </ChartZoom>
  );
}

export default LineChart;

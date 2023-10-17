import {useTheme} from '@emotion/react';

import ChartZoom from 'sentry/components/charts/chartZoom';
import VisualMap from 'sentry/components/charts/components/visualMap';
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
import {NormalizedTrendsTransaction} from 'sentry/views/performance/trends/types';
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

  const resultSeries = transformEventStats(statsData, chartLabel);

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
            options={{
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
            }}
            xAxis={{
              type: 'time',
            }}
          />
        );
      }}
    </ChartZoom>
  );
}

export default LineChart;

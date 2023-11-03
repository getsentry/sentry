import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import BaseChart from 'sentry/components/charts/baseChart';
import ChartZoom from 'sentry/components/charts/chartZoom';
import VisualMap from 'sentry/components/charts/components/visualMap';
import BarSeries from 'sentry/components/charts/series/barSeries';
import LineSeries from 'sentry/components/charts/series/lineSeries';
import {Series} from 'sentry/types/echarts';
import {getUserTimezone} from 'sentry/utils/dates';
import {
  axisLabelFormatter,
  getDurationUnit,
  tooltipFormatter,
} from 'sentry/utils/discover/charts';
import {aggregateOutputType, RateUnits} from 'sentry/utils/discover/fields';
import useRouter from 'sentry/utils/useRouter';
import {NormalizedTrendsTransaction} from 'sentry/views/performance/trends/types';
import {getIntervalLine} from 'sentry/views/performance/utils';

interface ChartProps {
  end: string;
  evidenceData: NormalizedTrendsTransaction;
  percentileSeries: Series[];
  start: string;
  throughputSeries: Series;
}

function LineChart({
  percentileSeries,
  throughputSeries,
  evidenceData,
  start,
  end,
}: ChartProps) {
  const theme = useTheme();
  const router = useRouter();

  const topSeries = useMemo(() => {
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

  const bottomSeries = useMemo(() => {
    if (evidenceData.breakpoint) {
      throughputSeries.markLine = {
        data: [
          {
            xAxis: evidenceData.breakpoint * 1000,
          },
        ],
        label: {show: false},
        lineStyle: {
          color: theme.red300,
          type: 'solid',
          width: 2,
        },
        symbol: ['none', 'none'],
        tooltip: {
          show: false,
        },
        silent: true,
      };
    }
    return [throughputSeries];
  }, [throughputSeries, evidenceData, theme]);

  const series = useMemo(() => {
    return [
      ...bottomSeries.map(({seriesName, data, ...options}) =>
        BarSeries({
          ...options,
          name: seriesName,
          data: data?.map(({value, name, itemStyle}) => {
            if (itemStyle === undefined) {
              return [name, value];
            }
            return {value: [name, value], itemStyle};
          }),
          animation: false,
          animationThreshold: 1,
          animationDuration: 0,
          xAxisIndex: 1,
          yAxisIndex: 1,
        })
      ),
      ...topSeries.map(({seriesName, data, ...options}) =>
        LineSeries({
          ...options,
          name: seriesName,
          data: data?.map(({value, name}) => [name, value]),
          animation: false,
          animationThreshold: 1,
          animationDuration: 0,
          showSymbol: false,
          xAxisIndex: 0,
          yAxisIndex: 0,
        })
      ),
    ];
  }, [topSeries, bottomSeries]);

  const chartOptions: Omit<
    React.ComponentProps<typeof BaseChart>,
    'series'
  > = useMemo(() => {
    const legend = {
      right: 16,
      top: 12,
      data: [...percentileSeries.map(s => s.seriesName), throughputSeries.seriesName],
    };

    const durationUnit = getDurationUnit(topSeries);

    const yAxes: React.ComponentProps<typeof BaseChart>['yAxes'] = [
      {
        minInterval: durationUnit,
        axisLabel: {
          color: theme.chartLabel,
          formatter: (value: number) =>
            axisLabelFormatter(value, 'duration', undefined, durationUnit),
        },
        gridIndex: 0,
      },
      {
        axisLabel: {
          color: theme.chartLabel,
          formatter: (value: number) =>
            axisLabelFormatter(value, 'rate', true, undefined, RateUnits.PER_SECOND),
        },
        gridIndex: 1,
      },
    ];

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
      height: 400,
      grid: [
        {
          top: '40px',
          bottom: '200px',
        },
        {
          top: '240px',
          bottom: '0px',
        },
      ],
      legend,
      toolBox: {show: false},
      tooltip: {
        valueFormatter: (value, seriesName) => {
          return tooltipFormatter(value, aggregateOutputType(seriesName));
        },
      },
      xAxes: [
        {gridIndex: 0, type: 'time'},
        {gridIndex: 1, type: 'time'},
      ],
      yAxes,
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
          // only want to apply the visual map on the first grid which contains the p95
          seriesIndex: series
            .map((s, idx) => (s.yAxisIndex === 0 ? idx : -1))
            .filter(idx => idx >= 0),
        }),
      },
    };
  }, [
    series,
    theme,
    topSeries,
    percentileSeries,
    throughputSeries,
    evidenceData.breakpoint,
  ]);

  return (
    <ChartZoom router={router} start={start} end={end} utc={getUserTimezone() === 'UTC'}>
      {zoomRenderProps => (
        <BaseChart {...zoomRenderProps} {...chartOptions} series={series} />
      )}
    </ChartZoom>
  );
}

export default LineChart;

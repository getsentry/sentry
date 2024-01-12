import {useMemo} from 'react';
import {type Theme, useTheme} from '@emotion/react';

import {
  LineChart,
  LineChartProps,
  LineChartSeries,
} from 'sentry/components/charts/lineChart';
import {t} from 'sentry/locale';
import {tooltipFormatter} from 'sentry/utils/discover/charts';
import {makeFormatter} from 'sentry/utils/profiling/units/units';

const durationFormatter = makeFormatter('nanoseconds', 0);

function asSeries(
  seriesName: string,
  color: string | undefined,
  data: {timestamp: number; value: number}[]
) {
  return {
    data: data.map(p => ({
      name: p.timestamp * 1e3,
      value: p.value ?? 0,
    })),
    color,
    seriesName,
  };
}

function getTooltipFormatter(label: string, baseline: number) {
  return [
    '<div class="tooltip-series tooltip-series-solo">',
    '<div>',
    `<span class="tooltip-label"><strong>${label}</strong></span>`,
    tooltipFormatter(baseline / 1e6, 'duration'),
    '</div>',
    '</div>',
    '<div class="tooltip-arrow"></div>',
  ].join('');
}

interface BaseSparklineChartProps {
  name: string;
  points: {timestamp: number; value: number}[];
  chartProps?: Partial<LineChartProps>;
  color?: string;
}
interface ProfilingSparklineChartPropsWithBreakpoint extends BaseSparklineChartProps {
  aggregate_range_1: number;
  aggregate_range_2: number;
  breakpoint: number;
  end: number;
  start: number;
}

interface ProfilingSparklineChartPropsWithoutBreakpoint extends BaseSparklineChartProps {}

function isBreakPointProps(
  props: ProfilingSparklineChartProps
): props is ProfilingSparklineChartPropsWithBreakpoint {
  return typeof (props as any).breakpoint === 'number';
}

type ProfilingSparklineChartProps =
  | ProfilingSparklineChartPropsWithBreakpoint
  | ProfilingSparklineChartPropsWithoutBreakpoint;

function makeSeriesBeforeAfterLines(
  start: number,
  breakpoint: number,
  end: number,
  aggregate_range_1: number,
  aggregate_range_2: number,
  theme: Theme
): LineChartSeries[] {
  const dividingLine = {
    data: [],
    color: theme.textColor,
    seriesName: 'dividing line',
    markLine: {},
  };
  dividingLine.markLine = {
    data: [{xAxis: breakpoint * 1e3}],
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

  const beforeLine = {
    data: [],
    color: theme.textColor,
    seriesName: 'before line',
    markLine: {},
  };
  beforeLine.markLine = {
    data: [
      [
        {value: 'Past', coord: [start * 1e3, aggregate_range_1]},
        {coord: [breakpoint * 1e3, aggregate_range_1]},
      ],
    ],
    label: {
      show: false,
    },
    lineStyle: {
      color: theme.textColor,
      type: 'dashed',
      width: 1,
    },
    symbol: ['none', 'none'],
    tooltip: {
      formatter: getTooltipFormatter(t('Past Baseline'), aggregate_range_1),
    },
  };

  const afterLine = {
    data: [],
    color: theme.textColor,
    seriesName: 'after line',
    markLine: {},
  };
  afterLine.markLine = {
    data: [
      [
        {
          value: 'Present',
          coord: [breakpoint * 1e3, aggregate_range_2],
        },
        {coord: [end * 1e3, aggregate_range_2]},
      ],
    ],
    label: {
      show: false,
    },
    lineStyle: {
      color: theme.textColor,
      type: 'dashed',
      width: 1,
    },
    symbol: ['none', 'none'],
    tooltip: {
      formatter: getTooltipFormatter(t('Present Baseline'), aggregate_range_2),
    },
  };
  return [dividingLine, beforeLine, afterLine];
}

export function ProfilingSparklineChart(props: ProfilingSparklineChartProps) {
  const theme = useTheme();

  const chartProps: LineChartProps = useMemo(() => {
    const additionalSeries: LineChartSeries[] = [];
    if (isBreakPointProps(props)) {
      additionalSeries.push(
        ...makeSeriesBeforeAfterLines(
          props.start,
          props.breakpoint,
          props.end,
          props.aggregate_range_1,
          props.aggregate_range_2,
          theme
        )
      );
    }
    const baseProps: LineChartProps = {
      height: 26,
      width: 'auto',
      series: [asSeries(props.name, props.color, props.points), ...additionalSeries],
      grid: [
        {
          containLabel: false,
          top: '2px',
          left: '2px',
          right: '2px',
          bottom: '2px',
        },
        {
          containLabel: false,
          top: '2px',
          left: '2px',
          right: '2px',
          bottom: '2px',
        },
      ],
      tooltip: {
        valueFormatter: (v: number) => durationFormatter(v),
      },
      axisPointer: {},
      xAxes: [
        {
          gridIndex: 0,
          type: 'time' as const,
          show: false,
        },
      ],
      yAxes: [
        {
          scale: true,
          show: false,
        },
      ],
      ...(props.chartProps ? props.chartProps : {}),
    };

    return baseProps;
  }, [props, theme]);

  return <LineChart {...chartProps} isGroupedByDate showTimeInTooltip />;
}

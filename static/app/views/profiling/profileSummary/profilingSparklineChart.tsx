import {useMemo} from 'react';

import {LineChart, LineChartProps} from 'sentry/components/charts/lineChart';
import {makeFormatter} from 'sentry/utils/profiling/units/units';

const durationFormatter = makeFormatter('nanoseconds', 0);

function asSeries(seriesName: string, data: {timestamp: number; value: number}[]) {
  return {
    data: data.map(p => ({
      name: p.timestamp,
      value: p.value ?? 0,
    })),
    seriesName,
  };
}

interface ProfilingSparklineChartProps {
  name: string;
  points: {timestamp: number; value: number}[];
  chartProps?: Partial<LineChartProps>;
}

export function ProfilingSparklineChart(props: ProfilingSparklineChartProps) {
  const chartProps: LineChartProps = useMemo(() => {
    const baseProps: LineChartProps = {
      height: 26,
      width: 'auto',
      series: [asSeries(props.name, props.points)],
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
  }, [props.points, props.name, props.chartProps]);

  return <LineChart {...chartProps} isGroupedByDate showTimeInTooltip />;
}

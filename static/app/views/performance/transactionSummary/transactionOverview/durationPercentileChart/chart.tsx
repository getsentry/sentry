import {useTheme} from '@emotion/react';

import {AreaChart} from 'sentry/components/charts/areaChart';
import {axisLabelFormatter, getDurationUnit} from 'sentry/utils/discover/charts';
import {getDuration} from 'sentry/utils/formatters';

type Props = React.ComponentPropsWithoutRef<typeof AreaChart>;

function Chart(props: Props) {
  const theme = useTheme();

  const durationUnit = getDurationUnit(props.series);

  return (
    <AreaChart
      grid={{left: '10px', right: '10px', top: '40px', bottom: '0px'}}
      xAxis={{
        type: 'category' as const,
        truncate: true,
        axisLabel: {
          showMinLabel: true,
          showMaxLabel: true,
        },
        axisTick: {
          interval: 0,
          alignWithLabel: true,
        },
      }}
      yAxis={{
        minInterval: durationUnit,
        type: 'value' as const,
        axisLabel: {
          color: theme.chartLabel,
          // Use p50() to force time formatting.
          formatter: (value: number) =>
            axisLabelFormatter(value, 'duration', undefined, durationUnit),
        },
      }}
      tooltip={{valueFormatter: value => getDuration(value / 1000, 2)}}
      {...props}
    />
  );
}

export default Chart;

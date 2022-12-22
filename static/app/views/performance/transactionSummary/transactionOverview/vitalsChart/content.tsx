import {InjectedRouter} from 'react-router';
import {Theme} from '@emotion/react';
import {Query} from 'history';

import ChartZoom from 'sentry/components/charts/chartZoom';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import {LineChart, LineChartProps} from 'sentry/components/charts/lineChart';
import ReleaseSeries from 'sentry/components/charts/releaseSeries';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import Placeholder from 'sentry/components/placeholder';
import {IconWarning} from 'sentry/icons';
import {Series} from 'sentry/types/echarts';
import {
  axisLabelFormatter,
  getDurationUnit,
  tooltipFormatter,
} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import getDynamicText from 'sentry/utils/getDynamicText';
import {TransactionsListOption} from 'sentry/views/releases/detail/overview';

type Props = {
  errored: boolean;
  loading: boolean;
  queryExtra: Query;
  reloading: boolean;
  router: InjectedRouter;
  theme: Theme;
  series?: Series[];
  timeFrame?: {
    end: number;
    start: number;
  };
} & Omit<React.ComponentProps<typeof ReleaseSeries>, 'children' | 'queryExtra'> &
  Pick<LineChartProps, 'onLegendSelectChanged' | 'legend'>;

function Content({
  errored,
  theme,
  series: data,
  timeFrame,
  start,
  end,
  period,
  projects,
  environments,
  loading,
  reloading,
  legend,
  utc,
  queryExtra,
  router,
  onLegendSelectChanged,
}: Props) {
  if (errored) {
    return (
      <ErrorPanel>
        <IconWarning color="gray500" size="lg" />
      </ErrorPanel>
    );
  }

  const colors = (data && theme.charts.getColorPalette(data.length - 2)) || [];

  // Create a list of series based on the order of the fields,
  const series = data
    ? data.map((values, i: number) => ({
        ...values,
        color: colors[i],
      }))
    : [];

  const durationUnit = getDurationUnit(series, legend);

  const chartOptions: Omit<LineChartProps, 'series'> = {
    grid: {
      left: '10px',
      right: '10px',
      top: '40px',
      bottom: '0px',
    },
    seriesOptions: {
      showSymbol: false,
    },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value, label) =>
        tooltipFormatter(value, aggregateOutputType(label)),
    },
    xAxis: timeFrame
      ? {
          min: timeFrame.start,
          max: timeFrame.end,
        }
      : undefined,
    yAxis: {
      minInterval: durationUnit,
      axisLabel: {
        color: theme.chartLabel,
        // p75(measurements.fcp) coerces the axis to be time based
        formatter: (value: number) =>
          axisLabelFormatter(value, 'duration', undefined, durationUnit),
      },
    },
  };

  return (
    <ChartZoom router={router} period={period} start={start} end={end} utc={utc}>
      {zoomRenderProps => (
        <ReleaseSeries
          start={start}
          end={end}
          queryExtra={{
            ...queryExtra,
            showTransactions: TransactionsListOption.SLOW_LCP,
          }}
          period={period}
          utc={utc}
          projects={projects}
          environments={environments}
        >
          {({releaseSeries}) => (
            <TransitionChart loading={loading} reloading={reloading}>
              <TransparentLoadingMask visible={reloading} />
              {getDynamicText({
                value: (
                  <LineChart
                    {...zoomRenderProps}
                    {...chartOptions}
                    legend={legend}
                    onLegendSelectChanged={onLegendSelectChanged}
                    series={[...series, ...releaseSeries]}
                  />
                ),
                fixed: <Placeholder height="200px" testId="skeleton-ui" />,
              })}
            </TransitionChart>
          )}
        </ReleaseSeries>
      )}
    </ChartZoom>
  );
}

export default Content;

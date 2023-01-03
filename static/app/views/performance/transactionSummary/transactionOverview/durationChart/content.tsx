import {InjectedRouter} from 'react-router';
import {Theme} from '@emotion/react';
import {Query} from 'history';

import {AreaChart} from 'sentry/components/charts/areaChart';
import ChartZoom from 'sentry/components/charts/chartZoom';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import {LineChartProps} from 'sentry/components/charts/lineChart';
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
  // We need to flip it at the end to ensure the series stack right.
  const series = data
    ? data
        .map((values, i: number) => {
          return {
            ...values,
            color: colors[i],
            lineStyle: {
              opacity: 0,
            },
          };
        })
        .reverse()
    : [];

  const durationUnit = getDurationUnit(series, legend);

  const chartOptions = {
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
      trigger: 'axis' as const,
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
        formatter: (value: number) => {
          return axisLabelFormatter(value, 'duration', undefined, durationUnit);
        },
      },
    },
  };

  return (
    <ChartZoom router={router} period={period} start={start} end={end} utc={utc}>
      {zoomRenderProps => (
        <ReleaseSeries
          start={start}
          end={end}
          queryExtra={queryExtra}
          period={period}
          utc={utc}
          projects={projects}
          environments={environments}
        >
          {({releaseSeries}) => {
            return (
              <TransitionChart loading={loading} reloading={reloading}>
                <TransparentLoadingMask visible={reloading} />
                {getDynamicText({
                  value: (
                    <AreaChart
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
            );
          }}
        </ReleaseSeries>
      )}
    </ChartZoom>
  );
}

export default Content;

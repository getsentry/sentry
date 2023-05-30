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
import {t} from 'sentry/locale';
import {Series} from 'sentry/types/echarts';
import {
  axisLabelFormatter,
  getDurationUnit,
  tooltipFormatter,
} from 'sentry/utils/discover/charts';
import getDynamicText from 'sentry/utils/getDynamicText';
import {NormalizedTrendsTransaction} from 'sentry/views/performance/trends/types';
import {getIntervalLine} from 'sentry/views/performance/utils';

import {transformEventStatsSmoothed} from '../../../trends/utils';

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
  transaction?: NormalizedTrendsTransaction;
  withBreakpoint?: boolean;
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
  withBreakpoint,
  transaction,
  onLegendSelectChanged,
}: Props) {
  if (errored) {
    return (
      <ErrorPanel>
        <IconWarning color="gray500" size="lg" />
      </ErrorPanel>
    );
  }

  const series = data
    ? data
        .map(values => {
          return {
            ...values,
            color: theme.purple300,
            lineStyle: {
              opacity: 0.75,
              width: 1,
            },
          };
        })
        .reverse()
    : [];

  const needsLabel = false;
  const breakpointSeries = withBreakpoint
    ? getIntervalLine(theme, data || [], 0.5, needsLabel, transaction)
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
      valueFormatter: (value: number | null) => tooltipFormatter(value, 'duration'),
    },
    xAxis: timeFrame
      ? {
          min: timeFrame.start,
          max: timeFrame.end,
        }
      : undefined,
    yAxis: {
      min: 0,
      minInterval: durationUnit,
      axisLabel: {
        color: theme.chartLabel,
        formatter: (value: number) =>
          axisLabelFormatter(value, 'duration', undefined, durationUnit),
      },
    },
  };

  const {smoothedResults} = transformEventStatsSmoothed(data, t('Smoothed'));

  const smoothedSeries = smoothedResults
    ? smoothedResults.map(values => {
        return {
          ...values,
          color: theme.purple300,
          lineStyle: {
            opacity: 1,
          },
        };
      })
    : [];

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
                    series={[
                      ...series,
                      ...smoothedSeries,
                      ...releaseSeries,
                      ...breakpointSeries,
                    ]}
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

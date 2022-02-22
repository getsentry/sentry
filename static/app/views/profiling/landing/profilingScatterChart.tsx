import React from 'react';
import {browserHistory, withRouter, WithRouterProps} from 'react-router';
import {useTheme} from '@emotion/react';
import {Location} from 'history';

import ChartZoom from 'sentry/components/charts/chartZoom';
import OptionSelector from 'sentry/components/charts/optionSelector';
import ScatterChart from 'sentry/components/charts/scatterChart';
import {
  ChartContainer,
  ChartControls,
  InlineContainer,
} from 'sentry/components/charts/styles';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {getSeriesSelection} from 'sentry/components/charts/utils';
import {Panel} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {Series, SeriesDataUnit} from 'sentry/types/echarts';
import {Trace} from 'sentry/types/profiling/core';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
import {Theme} from 'sentry/utils/theme';

import {COLOR_ENCODINGS, getColorEncodingFromLocation} from '../utils';

interface ProfilingScatterChartProps extends WithRouterProps {
  loading: boolean;
  location: Location;
  reloading: boolean;
  traces: Trace[];
  end?: string;
  start?: string;
  statsPeriod?: string | null;
  utc?: string;
}

function ProfilingScatterChart({
  router,
  location,
  traces,
  loading,
  reloading,
  start,
  end,
  statsPeriod,
  utc,
}: ProfilingScatterChartProps) {
  const theme = useTheme();

  const colorEncoding = React.useMemo(
    () => getColorEncodingFromLocation(location),
    [location]
  );

  const series: Series[] = React.useMemo(() => {
    const seriesMap: Record<string, SeriesDataUnit[]> = {};

    for (const row of traces) {
      const seriesName = row[colorEncoding];
      if (!seriesMap[seriesName]) {
        seriesMap[seriesName] = [];
      }
      seriesMap[seriesName].push({
        name: row.start_time_unix * 1000,
        value: row.trace_duration_ms,
      });
    }

    return Object.entries(seriesMap).map(([seriesName, data]) => ({seriesName, data}));
  }, [colorEncoding, traces]);

  const chartOptions = React.useMemo(
    () => makeScatterChartOptions({location, theme}),
    [location, theme]
  );

  const handleColorEncodingChange = React.useCallback(
    value => {
      browserHistory.push({
        ...location,
        query: {
          ...location.query,
          colorEncoding: value,
        },
      });
    },
    [location]
  );

  return (
    <Panel>
      <ChartContainer>
        <ChartZoom
          router={router}
          period={statsPeriod}
          start={start}
          end={end}
          utc={utc === 'true'}
        >
          {zoomRenderProps => {
            return (
              <TransitionChart loading={loading} reloading={reloading}>
                <TransparentLoadingMask visible={reloading} />
                <ScatterChart series={series} {...chartOptions} {...zoomRenderProps} />
              </TransitionChart>
            );
          }}
        </ChartZoom>
      </ChartContainer>
      <ChartControls>
        <InlineContainer>
          <OptionSelector
            title={t('Group By')}
            selected={colorEncoding}
            options={COLOR_ENCODINGS}
            onChange={handleColorEncodingChange}
          />
        </InlineContainer>
      </ChartControls>
    </Panel>
  );
}

function makeScatterChartOptions({location, theme}: {location: Location; theme: Theme}) {
  return {
    grid: {
      left: '10px',
      right: '10px',
      top: '40px',
      bottom: '0px',
    },
    tooltip: {
      trigger: 'item' as const,
      valueFormatter: (value: number) => tooltipFormatter(value, 'p50()'),
    },
    yAxis: {
      axisLabel: {
        color: theme.chartLabel,
        formatter: (value: number) => axisLabelFormatter(value, 'p50()'),
      },
    },
    legend: {
      right: 10,
      top: 5,
      selected: getSeriesSelection(location),
    },
    onClick: _params => {}, // TODO
  };
}

const ProfilingScatterChartWithRouter = withRouter(ProfilingScatterChart);

export {ProfilingScatterChartWithRouter as ProfilingScatterChart};

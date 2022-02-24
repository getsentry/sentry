import {useCallback, useMemo} from 'react';
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
import {Organization, Project} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {Trace} from 'sentry/types/profiling/core';
import {defined} from 'sentry/utils';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
import {Theme} from 'sentry/utils/theme';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import {generateFlamegraphRoute} from '../routes';
import {COLOR_ENCODINGS, getColorEncodingFromLocation} from '../utils';

interface ProfilingScatterChartProps extends WithRouterProps {
  isLoading: boolean;
  location: Location;
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
  isLoading,
  start,
  end,
  statsPeriod,
  utc,
}: ProfilingScatterChartProps) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const theme = useTheme();

  const colorEncoding = useMemo(() => getColorEncodingFromLocation(location), [location]);

  const data: Record<string, Trace[]> = useMemo(() => {
    const dataMap = {};
    for (const row of traces) {
      const seriesName = row[colorEncoding];
      if (!dataMap[seriesName]) {
        dataMap[seriesName] = [];
      }
      dataMap[seriesName].push(row);
    }
    return dataMap;
  }, [colorEncoding, traces]);

  const series: Series[] = useMemo(() => {
    return Object.entries(data).map(([seriesName, seriesData]) => {
      return {
        seriesName,
        data: seriesData.map(row => ({
          name: row.start_time_unix * 1000,
          value: row.trace_duration_ms,
        })),
      };
    });
  }, [data]);

  const chartOptions = useMemo(
    () =>
      makeScatterChartOptions({
        data,
        location,
        organization,
        projects,
        theme,
      }),
    [location, theme, data]
  );

  const handleColorEncodingChange = useCallback(
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
              <TransitionChart loading={isLoading} reloading={isLoading}>
                <TransparentLoadingMask visible={isLoading} />
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

function makeScatterChartOptions({
  data,
  location,
  organization,
  projects,
  theme,
}: {
  /**
   * The data is a mapping from the series name to a list of traces in the series. In particular,
   * the order of the traces must match the order of the data in the series in the scatter plot.
   */
  data: Record<string, Trace[]>;
  location: Location;
  organization: Organization;
  projects: Project[];
  theme: Theme;
}) {
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
    onClick: params => {
      const dataPoint = data[params.seriesName]?.[params.dataIndex];
      if (!defined(dataPoint)) {
        return;
      }
      const project = projects.find(proj => proj.id === dataPoint.app_id);
      if (!defined(project)) {
        return;
      }
      const target = generateFlamegraphRoute({
        orgSlug: organization.slug,
        projectSlug: project.slug,
        profileId: dataPoint.id,
      });
      browserHistory.push(target);
    },
  };
}

const ProfilingScatterChartWithRouter = withRouter(ProfilingScatterChart);

export {ProfilingScatterChartWithRouter as ProfilingScatterChart};

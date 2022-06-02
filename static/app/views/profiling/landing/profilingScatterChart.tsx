import {useCallback, useMemo} from 'react';
import {browserHistory, withRouter, WithRouterProps} from 'react-router';
import {useTheme} from '@emotion/react';
import type {TooltipComponentFormatterCallback} from 'echarts';
import {Location} from 'history';
import moment from 'moment';
import momentTimezone from 'moment-timezone';

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
import ConfigStore from 'sentry/stores/configStore';
import {Organization, PageFilters, Project} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {Trace} from 'sentry/types/profiling/core';
import {defined} from 'sentry/utils';
import {axisLabelFormatter} from 'sentry/utils/discover/charts';
import {getDuration} from 'sentry/utils/formatters';
import {generateFlamegraphSummaryRoute} from 'sentry/utils/profiling/routes';
import {Theme} from 'sentry/utils/theme';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import {COLOR_ENCODINGS, getColorEncodingFromLocation} from '../utils';

interface ProfilingScatterChartProps extends WithRouterProps {
  datetime: PageFilters['datetime'];
  isLoading: boolean;
  traces: Trace[];
}

function ProfilingScatterChart({
  router,
  location,
  datetime,
  isLoading,
  traces,
}: ProfilingScatterChartProps) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const theme = useTheme();

  const colorEncoding = useMemo(() => getColorEncodingFromLocation(location), [location]);

  const data: Record<string, Trace[]> = useMemo(() => {
    const dataMap = {};
    for (const row of traces) {
      const seriesName =
        colorEncoding === 'version'
          ? `${row.version_name} (build ${row.version_code})`
          : row[colorEncoding];
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
          name: row.timestamp * 1000,
          value: row.trace_duration_ms,
        })),
      };
    });
  }, [data]);

  const chartOptions = useMemo(
    () =>
      makeScatterChartOptions({
        data,
        datetime,
        location,
        organization,
        projects,
        theme,
      }),
    [location, datetime, theme, data, organization, projects]
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
          period={datetime.period}
          start={datetime.start}
          end={datetime.end}
          utc={datetime.utc}
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
  datetime,
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
  datetime: PageFilters['datetime'];
  location: Location;
  organization: Organization;
  projects: Project[];
  theme: Theme;
}) {
  const user = ConfigStore.get('user');
  const options = user?.options;

  const _tooltipFormatter: TooltipComponentFormatterCallback<any> = seriesParams => {
    const dataPoint = data[seriesParams.seriesName]?.[seriesParams.dataIndex];
    const project = dataPoint && projects.find(proj => proj.id === dataPoint.project_id);

    const entries = [
      {label: t('Project'), value: project?.slug},
      {label: t('App Version'), value: dataPoint?.version_code},
      {
        label: t('Duration'),
        value: defined(dataPoint?.trace_duration_ms)
          ? getDuration(dataPoint?.trace_duration_ms / 1000, 2, true)
          : null,
      },
      {label: t('Transaction'), value: dataPoint?.transaction_name},
      {label: t('Device Model'), value: dataPoint?.device_model},
      {label: t('Device Classification'), value: dataPoint?.device_classification},
      {label: t('Device Manufacturer'), value: dataPoint?.device_manufacturer},
    ].map(
      ({label, value}) =>
        `<div><span class="tooltip-label"><strong>${label}</strong></span> ${
          value ?? t('Unknown')
        }</div>`
    );

    const date = defined(dataPoint?.timestamp)
      ? momentTimezone
          .tz(dataPoint?.timestamp * 1000, options?.timezone ?? '')
          .format('lll')
      : null;

    return [
      '<div class="tooltip-series">',
      ...entries,
      '</div>',
      `<div class="tooltip-date">${date}</div>`,
      '<div class="tooltip-arrow"></div>',
    ].join('');
  };

  const now = moment.utc();
  const end = (defined(datetime.end) ? moment.utc(datetime.end) : now).valueOf();
  const start = (
    defined(datetime.start)
      ? moment.utc(datetime.start)
      : now.subtract(
          parseInt(datetime.period ?? '14', 10),
          datetime.period?.charAt(datetime.period.length - 1) === 'h' ? 'hours' : 'days'
        )
  ).valueOf();

  return {
    grid: {
      left: '10px',
      right: '10px',
      top: '40px',
      bottom: '0px',
    },
    tooltip: {
      trigger: 'item' as const,
      formatter: _tooltipFormatter,
    },
    xAxis: {
      // need to specify a min/max on the date range here
      // or echarts will use the min/max from the series
      min: start,
      max: end,
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
      const project = projects.find(proj => proj.id === dataPoint.project_id);
      if (!defined(project)) {
        return;
      }
      browserHistory.push(
        generateFlamegraphSummaryRoute({
          orgSlug: organization.slug,
          projectSlug: project.slug,
          profileId: dataPoint.id,
        })
      );
    },
  };
}

const ProfilingScatterChartWithRouter = withRouter(ProfilingScatterChart);

export {ProfilingScatterChartWithRouter as ProfilingScatterChart};

import {type Theme, useTheme} from '@emotion/react';
import type {Location} from '@sentry/react/build/types/types';

import ChartZoom from 'sentry/components/charts/chartZoom';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import EventsRequest from 'sentry/components/charts/eventsRequest';
import type {LineChartProps} from 'sentry/components/charts/lineChart';
import {LineChart} from 'sentry/components/charts/lineChart';
import ReleaseSeries from 'sentry/components/charts/releaseSeries';
import {ChartContainer, HeaderTitleLegend} from 'sentry/components/charts/styles';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {getSeriesSelection} from 'sentry/components/charts/utils';
import Panel from 'sentry/components/panels/panel';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {DateString} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {OrganizationSummary} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
import type EventView from 'sentry/utils/discover/eventView';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {WebVital} from 'sentry/utils/fields';
import getDynamicText from 'sentry/utils/getDynamicText';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';

export type ViewProps = Pick<EventView, (typeof QUERY_KEYS)[number]>;

type Props = Omit<ViewProps, 'start' | 'end'> & {
  end: DateString | null;
  interval: string;
  organization: OrganizationSummary;
  start: DateString | null;
};

function vitalNameFromLocation(location: Location): WebVital {
  const _vitalName = decodeScalar(location.query.vitalName);

  const vitalName = Object.values(WebVital).find(v => v === _vitalName);

  if (vitalName) {
    return vitalName;
  }
  return WebVital.LCP;
}

function VitalChart({
  project,
  environment,
  organization,
  query,
  statsPeriod,
  start,
  end,
  interval,
}: Props) {
  const location = useLocation();
  const api = useApi();
  const theme = useTheme();

  const vitalName = vitalNameFromLocation(location);
  const yAxis = `p75(${vitalName})`;

  const {utc, legend, vitalPoor, markLines, chartOptions} = getVitalChartDefinitions({
    theme,
    location,
    yAxis,
    vital: vitalName,
  });

  function handleLegendSelectChanged(legendChange: {
    name: string;
    selected: Record<string, boolean>;
    type: string;
  }) {
    const {selected} = legendChange;
    const unselected = Object.keys(selected).filter(key => !selected[key]);

    const to = {
      ...location,
      query: {
        ...location.query,
        unselectedSeries: unselected,
      },
    };
    browserHistory.push(to);
  }

  return (
    <Panel>
      <ChartContainer>
        <HeaderTitleLegend>
          {getVitalChartTitle(vitalName)}
          <QuestionTooltip
            size="sm"
            position="top"
            title={t('The durations shown should fall under the vital threshold.')}
          />
        </HeaderTitleLegend>
        <ChartZoom period={statsPeriod} start={start} end={end} utc={utc}>
          {zoomRenderProps => (
            <EventsRequest
              api={api}
              organization={organization}
              period={statsPeriod}
              project={project}
              environment={environment}
              start={start}
              end={end}
              interval={interval}
              showLoading={false}
              query={query}
              includePrevious={false}
              yAxis={[yAxis]}
              partial
            >
              {({timeseriesData: results, errored, loading, reloading}) => {
                if (errored) {
                  return (
                    <ErrorPanel>
                      <IconWarning color="gray500" size="lg" />
                    </ErrorPanel>
                  );
                }

                const colors =
                  (results && theme.charts.getColorPalette(results.length - 2)) || [];

                const {smoothedResults} = transformEventStatsSmoothed(results);

                const smoothedSeries = smoothedResults
                  ? smoothedResults.map(({seriesName, ...rest}, i: number) => {
                      return {
                        seriesName: replaceSeriesName(seriesName) || 'p75',
                        ...rest,
                        color: colors[i],
                        lineStyle: {
                          opacity: 1,
                          width: 2,
                        },
                      };
                    })
                  : [];

                const seriesMax = getMaxOfSeries(smoothedSeries);
                const yAxisMax = Math.max(seriesMax, vitalPoor);
                chartOptions.yAxis!.max = yAxisMax * 1.1;

                return (
                  <ReleaseSeries
                    start={start}
                    end={end}
                    period={statsPeriod}
                    utc={utc}
                    projects={project}
                    environments={environment}
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
                              onLegendSelectChanged={handleLegendSelectChanged}
                              series={[...markLines, ...releaseSeries, ...smoothedSeries]}
                            />
                          ),
                          fixed: 'Web Vitals Chart',
                        })}
                      </TransitionChart>
                    )}
                  </ReleaseSeries>
                );
              }}
            </EventsRequest>
          )}
        </ChartZoom>
      </ChartContainer>
    </Panel>
  );
}

export default VitalChart;

export type _VitalChartProps = {
  field: string;
  grid: LineChartProps['grid'];
  loading: boolean;
  reloading: boolean;
  data?: Series[];
  height?: number;
  utc?: boolean;
  vitalFields?: {
    goodCountField: string;
    mehCountField: string;
    poorCountField: string;
  };
};

function fieldToVitalType(
  seriesName: string,
  vitalFields: _VitalChartProps['vitalFields']
): VitalState | undefined {
  if (seriesName === vitalFields?.poorCountField.replace('equation|', '')) {
    return VitalState.POOR;
  }
  if (seriesName === vitalFields?.mehCountField.replace('equation|', '')) {
    return VitalState.MEH;
  }
  if (seriesName === vitalFields?.goodCountField.replace('equation|', '')) {
    return VitalState.GOOD;
  }

  return undefined;
}

export function _VitalChart(props: _VitalChartProps) {
  const {
    field: yAxis,
    data: _results,
    loading,
    reloading,
    height,
    grid,
    utc,
    vitalFields,
  } = props;
  const theme = useTheme();

  if (!_results || !vitalFields) {
    return null;
  }

  const chartOptions: Omit<LineChartProps, 'series'> = {
    grid,
    seriesOptions: {
      showSymbol: false,
    },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: number, seriesName?: string) => {
        return tooltipFormatter(
          value,
          aggregateOutputType(vitalFields[0] === WebVital.CLS ? seriesName : yAxis)
        );
      },
    },
    xAxis: {
      show: false,
    },
    xAxes: undefined,
    yAxis: {
      axisLabel: {
        color: theme.chartLabel,
        showMaxLabel: false,
        formatter: (value: number) =>
          axisLabelFormatter(value, aggregateOutputType(yAxis)),
      },
    },
    utc,
    isGroupedByDate: true,
    showTimeInTooltip: true,
  };

  const results = _results.filter(s => !!fieldToVitalType(s.seriesName, vitalFields));

  const smoothedSeries = results?.length
    ? results.map(({seriesName, ...rest}) => {
        const adjustedSeries = fieldToVitalType(seriesName, vitalFields) || 'count';
        return {
          seriesName: adjustedSeries,
          ...rest,
          color: theme[vitalStateColors[adjustedSeries]],
          lineStyle: {
            opacity: 1,
            width: 2,
          },
        };
      })
    : [];

  return (
    <div>
      <TransitionChart loading={loading} reloading={reloading}>
        <TransparentLoadingMask visible={reloading} />
        {getDynamicText({
          value: (
            <LineChart
              height={height}
              {...chartOptions}
              onLegendSelectChanged={() => {}}
              series={[...smoothedSeries]}
              isGroupedByDate
            />
          ),
          fixed: 'Web Vitals Chart',
        })}
      </TransitionChart>
    </div>
  );
}

export function getVitalChartDefinitions({
  theme,
  location,
  vital,
  yAxis,
}: {
  location: Location;
  theme: Theme;
  vital: string;
  yAxis: string;
}) {
  const utc = decodeScalar(location.query.utc) !== 'false';

  const vitalPoor = webVitalPoor[vital];
  const vitalMeh = webVitalMeh[vital];

  const legend = {
    right: 10,
    top: 0,
    selected: getSeriesSelection(location),
  };

  const chartOptions: Omit<LineChartProps, 'series'> = {
    grid: {
      left: '5px',
      right: '10px',
      top: '35px',
      bottom: '0px',
    },
    seriesOptions: {
      showSymbol: false,
    },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: number, seriesName?: string) =>
        tooltipFormatter(
          value,
          aggregateOutputType(vital === WebVital.CLS ? seriesName : yAxis)
        ),
    },
    yAxis: {
      min: 0,
      max: vitalPoor,
      axisLabel: {
        color: theme.chartLabel,
        showMaxLabel: false,
        // coerces the axis to be time based
        formatter: (value: number) =>
          axisLabelFormatter(value, aggregateOutputType(yAxis)),
      },
    },
  };

  const markLines = [
    {
      seriesName: 'Thresholds',
      type: 'line' as const,
      data: [],
      markLine: MarkLine({
        silent: true,
        lineStyle: {
          color: theme.red300,
          type: 'dashed',
          width: 1.5,
        },
        label: {
          show: true,
          position: 'insideEndTop',
          formatter: t('Poor'),
        },
        data: [
          {
            yAxis: vitalPoor,
          } as any, // TODO(ts): date on this type is likely incomplete (needs @types/echarts@4.6.2)
        ],
      }),
    },
    {
      seriesName: 'Thresholds',
      type: 'line' as const,
      data: [],
      markLine: MarkLine({
        silent: true,
        lineStyle: {
          color: theme.yellow300,
          type: 'dashed',
          width: 1.5,
        },
        label: {
          show: true,
          position: 'insideEndTop',
          formatter: t('Meh'),
        },
        data: [
          {
            yAxis: vitalMeh,
          } as any, // TODO(ts): date on this type is likely incomplete (needs @types/echarts@4.6.2)
        ],
      }),
    },
  ];

  return {
    vitalPoor,
    vitalMeh,
    legend,
    chartOptions,
    markLines,
    utc,
  };
}

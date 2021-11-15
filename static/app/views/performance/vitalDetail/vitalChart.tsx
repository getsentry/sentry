import {browserHistory, withRouter, WithRouterProps} from 'react-router';
import {useTheme} from '@emotion/react';
import {Location} from 'history';

import ChartZoom from 'app/components/charts/chartZoom';
import MarkLine from 'app/components/charts/components/markLine';
import ErrorPanel from 'app/components/charts/errorPanel';
import EventsRequest from 'app/components/charts/eventsRequest';
import LineChart from 'app/components/charts/lineChart';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import {ChartContainer, HeaderTitleLegend} from 'app/components/charts/styles';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import {getInterval, getSeriesSelection} from 'app/components/charts/utils';
import {Panel} from 'app/components/panels';
import QuestionTooltip from 'app/components/questionTooltip';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import {OrganizationSummary} from 'app/types';
import {Series} from 'app/types/echarts';
import {getUtcToLocalDateObject} from 'app/utils/dates';
import {axisLabelFormatter, tooltipFormatter} from 'app/utils/discover/charts';
import EventView from 'app/utils/discover/eventView';
import {WebVital} from 'app/utils/discover/fields';
import getDynamicText from 'app/utils/getDynamicText';
import {decodeScalar} from 'app/utils/queryString';
import useApi from 'app/utils/useApi';

import {replaceSeriesName, transformEventStatsSmoothed} from '../trends/utils';

import {
  getMaxOfSeries,
  vitalNameFromLocation,
  VitalState,
  vitalStateColors,
  webVitalMeh,
  webVitalPoor,
} from './utils';

const QUERY_KEYS = [
  'environment',
  'project',
  'query',
  'start',
  'end',
  'statsPeriod',
] as const;

type ViewProps = Pick<EventView, typeof QUERY_KEYS[number]>;

type Props = WithRouterProps &
  ViewProps & {
    location: Location;
    organization: OrganizationSummary;
  };

function VitalChart({
  project,
  environment,
  location,
  organization,
  query,
  statsPeriod,
  router,
  start: propsStart,
  end: propsEnd,
}: Props) {
  const api = useApi();
  const theme = useTheme();

  const handleLegendSelectChanged = legendChange => {
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
  };

  const start = propsStart ? getUtcToLocalDateObject(propsStart) : null;
  const end = propsEnd ? getUtcToLocalDateObject(propsEnd) : null;
  const utc = decodeScalar(router.location.query.utc) !== 'false';

  const vitalName = vitalNameFromLocation(location);

  const yAxis = `p75(${vitalName})`;

  const legend = {
    right: 10,
    top: 0,
    selected: getSeriesSelection(location),
  };

  const datetimeSelection = {
    start,
    end,
    period: statsPeriod,
  };

  const vitalPoor = webVitalPoor[vitalName];
  const vitalMeh = webVitalMeh[vitalName];

  const markLines = [
    {
      seriesName: 'Thresholds',
      type: 'line',
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
      type: 'line',
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

  const chartOptions = {
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
      trigger: 'axis' as const,
      valueFormatter: (value: number, seriesName?: string) =>
        tooltipFormatter(value, vitalName === WebVital.CLS ? seriesName : yAxis),
    },
    yAxis: {
      min: 0,
      max: vitalPoor,
      axisLabel: {
        color: theme.chartLabel,
        showMaxLabel: false,
        // coerces the axis to be time based
        formatter: (value: number) => axisLabelFormatter(value, yAxis),
      },
    },
  };

  return (
    <Panel>
      <ChartContainer>
        <HeaderTitleLegend>
          {t('Duration p75')}
          <QuestionTooltip
            size="sm"
            position="top"
            title={t(`The durations shown should fall under the vital threshold.`)}
          />
        </HeaderTitleLegend>
        <ChartZoom router={router} period={statsPeriod} start={start} end={end} utc={utc}>
          {zoomRenderProps => (
            <EventsRequest
              api={api}
              organization={organization}
              period={statsPeriod}
              project={project}
              environment={environment}
              start={start}
              end={end}
              interval={getInterval(datetimeSelection, 'high')}
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
                chartOptions.yAxis.max = yAxisMax * 1.1;

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

export default withRouter(VitalChart);

export type _VitalChartProps = Props & {
  data?: Series[];
  loading: boolean;
  reloading: boolean;
  field: string;
  height?: number;
  grid: LineChart['props']['grid'];
  vitalFields?: {
    poorCountField: string;
    mehCountField: string;
    goodCountField: string;
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

function __VitalChart(props: _VitalChartProps) {
  const {
    field: yAxis,
    data: _results,
    loading,
    reloading,
    height,
    grid,
    vitalFields,
  } = props;
  if (!_results || !vitalFields) {
    return null;
  }
  const theme = useTheme();

  const chartOptions = {
    grid,
    seriesOptions: {
      showSymbol: false,
    },
    tooltip: {
      trigger: 'axis' as const,
      valueFormatter: tooltipFormatter,
    },
    xAxis: {
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      splitLine: {
        show: false,
      },
    },
    yAxis: {
      axisLabel: {
        color: theme.chartLabel,
        showMaxLabel: false,
        formatter: (value: number) => axisLabelFormatter(value, yAxis),
      },
    },
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
            />
          ),
          fixed: 'Web Vitals Chart',
        })}
      </TransitionChart>
    </div>
  );
}

export const _VitalChart = withRouter(__VitalChart);

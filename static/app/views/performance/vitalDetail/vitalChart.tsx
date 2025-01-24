import {useTheme} from '@emotion/react';

import ChartZoom from 'sentry/components/charts/chartZoom';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import EventsRequest from 'sentry/components/charts/eventsRequest';
import type {LineChartProps} from 'sentry/components/charts/lineChart';
import {LineChart} from 'sentry/components/charts/lineChart';
import ReleaseSeries from 'sentry/components/charts/releaseSeries';
import {ChartContainer, HeaderTitleLegend} from 'sentry/components/charts/styles';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import Panel from 'sentry/components/panels/panel';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {DateString} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {OrganizationSummary} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {WebVital} from 'sentry/utils/fields';
import getDynamicText from 'sentry/utils/getDynamicText';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';

import {replaceSeriesName, transformEventStatsSmoothed} from '../trends/utils';
import type {ViewProps} from '../types';

import {
  getMaxOfSeries,
  getVitalChartDefinitions,
  getVitalChartTitle,
  vitalNameFromLocation,
  VitalState,
  vitalStateColors,
} from './utils';

type Props = Omit<ViewProps, 'start' | 'end'> & {
  end: DateString | null;
  interval: string;
  organization: OrganizationSummary;
  start: DateString | null;
};

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

export type VitalChartInnerProps = {
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
  vitalFields: VitalChartInnerProps['vitalFields']
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

export function VitalChartInner(props: VitalChartInnerProps) {
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
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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

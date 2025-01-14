import {Component, Fragment} from 'react';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import type {LegendComponentOption, LineSeriesOption} from 'echarts';
import isEqual from 'lodash/isEqual';

import type {Client} from 'sentry/api';
import {BarChart} from 'sentry/components/charts/barChart';
import type {ZoomRenderProps} from 'sentry/components/charts/chartZoom';
import ChartZoom from 'sentry/components/charts/chartZoom';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import type {LineChartProps} from 'sentry/components/charts/lineChart';
import {LineChart} from 'sentry/components/charts/lineChart';
import ReleaseSeries from 'sentry/components/charts/releaseSeries';
import StackedAreaChart from 'sentry/components/charts/stackedAreaChart';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {RELEASE_LINES_THRESHOLD} from 'sentry/components/charts/utils';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {EChartEventHandler, Series} from 'sentry/types/echarts';
import type {Organization} from 'sentry/types/organization';
import getDynamicText from 'sentry/utils/getDynamicText';
import {MINUTES_THRESHOLD_TO_DISPLAY_SECONDS} from 'sentry/utils/sessions';
import withPageFilters from 'sentry/utils/withPageFilters';
import {displayCrashFreePercent} from 'sentry/views/releases/utils';
import {sessionTerm} from 'sentry/views/releases/utils/sessionTerm';

import {DisplayModes} from '../projectCharts';

import ProjectSessionsAnrRequest from './projectSessionsAnrRequest';
import ProjectSessionsChartRequest from './projectSessionsChartRequest';

type Props = {
  api: Client;
  displayMode:
    | DisplayModes.SESSIONS
    | DisplayModes.STABILITY_USERS
    | DisplayModes.ANR_RATE
    | DisplayModes.FOREGROUND_ANR_RATE
    | DisplayModes.STABILITY;
  onTotalValuesChange: (value: number | null) => void;
  organization: Organization;
  selection: PageFilters;
  title: string;
  disablePrevious?: boolean;
  help?: string;
  query?: string;
};

function ProjectBaseSessionsChart({
  title,
  organization,
  selection,
  api,
  onTotalValuesChange,
  displayMode,
  help,
  disablePrevious,
  query,
}: Props) {
  const theme = useTheme();

  const {projects, environments, datetime} = selection;
  const {start, end, period, utc} = datetime;

  const Request = [DisplayModes.ANR_RATE, DisplayModes.FOREGROUND_ANR_RATE].includes(
    displayMode
  )
    ? ProjectSessionsAnrRequest
    : ProjectSessionsChartRequest;

  return (
    <Fragment>
      {getDynamicText({
        value: (
          <ChartZoom period={period} start={start} end={end} utc={utc}>
            {zoomRenderProps => (
              <Request
                api={api}
                selection={selection}
                organization={organization}
                onTotalValuesChange={onTotalValuesChange}
                displayMode={displayMode}
                disablePrevious={disablePrevious}
                query={query}
              >
                {({
                  errored,
                  loading,
                  reloading,
                  timeseriesData,
                  previousTimeseriesData,
                  additionalSeries,
                }) => (
                  <ReleaseSeries
                    utc={utc}
                    period={period}
                    start={start}
                    end={end}
                    projects={projects}
                    environments={environments}
                    query={query}
                  >
                    {({releaseSeries}) => {
                      if (errored) {
                        return (
                          <ErrorPanel>
                            <IconWarning color="gray300" size="lg" />
                          </ErrorPanel>
                        );
                      }

                      return (
                        <TransitionChart loading={loading} reloading={reloading}>
                          <TransparentLoadingMask visible={reloading} />

                          <HeaderTitleLegend>
                            {title}
                            {help && (
                              <QuestionTooltip size="sm" position="top" title={help} />
                            )}
                          </HeaderTitleLegend>

                          <Chart
                            theme={theme}
                            zoomRenderProps={zoomRenderProps}
                            reloading={reloading}
                            timeSeries={timeseriesData}
                            previousTimeSeries={
                              previousTimeseriesData
                                ? [previousTimeseriesData]
                                : undefined
                            }
                            releaseSeries={releaseSeries}
                            displayMode={displayMode}
                            additionalSeries={additionalSeries}
                          />
                        </TransitionChart>
                      );
                    }}
                  </ReleaseSeries>
                )}
              </Request>
            )}
          </ChartZoom>
        ),
        fixed: `${title} Chart`,
      })}
    </Fragment>
  );
}

type ChartProps = {
  displayMode:
    | DisplayModes.SESSIONS
    | DisplayModes.STABILITY
    | DisplayModes.STABILITY_USERS
    | DisplayModes.ANR_RATE
    | DisplayModes.FOREGROUND_ANR_RATE;
  releaseSeries: Series[];
  reloading: boolean;
  theme: Theme;
  timeSeries: Series[];
  zoomRenderProps: ZoomRenderProps;
  additionalSeries?: LineSeriesOption[];
  previousTimeSeries?: Series[];
};

type ChartState = {
  forceUpdate: boolean;
  seriesSelection: Record<string, boolean>;
};

class Chart extends Component<ChartProps, ChartState> {
  state: ChartState = {
    seriesSelection: {},
    forceUpdate: false,
  };

  shouldComponentUpdate(nextProps: ChartProps, nextState: ChartState) {
    if (nextState.forceUpdate) {
      return true;
    }

    if (!isEqual(this.state.seriesSelection, nextState.seriesSelection)) {
      return true;
    }

    if (
      nextProps.releaseSeries !== this.props.releaseSeries &&
      !nextProps.reloading &&
      !this.props.reloading
    ) {
      return true;
    }

    if (this.props.reloading && !nextProps.reloading) {
      return true;
    }

    if (nextProps.timeSeries !== this.props.timeSeries) {
      return true;
    }

    return false;
  }

  // inspired by app/components/charts/eventsChart.tsx@handleLegendSelectChanged
  handleLegendSelectChanged: EChartEventHandler<{
    name: string;
    selected: Record<string, boolean>;
    type: 'legendselectchanged';
  }> = ({selected}) => {
    const seriesSelection = Object.keys(selected).reduce((state, key) => {
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      state[key] = selected[key];
      return state;
    }, {});

    // we have to force an update here otherwise ECharts will
    // update its internal state and disable the series
    this.setState({seriesSelection, forceUpdate: true}, () =>
      this.setState({forceUpdate: false})
    );
  };

  get isCrashFree() {
    const {displayMode} = this.props;

    return [DisplayModes.STABILITY, DisplayModes.STABILITY_USERS].includes(displayMode);
  }

  get isAnr() {
    const {displayMode} = this.props;

    return [DisplayModes.ANR_RATE, DisplayModes.FOREGROUND_ANR_RATE].includes(
      displayMode
    );
  }

  get legend(): LegendComponentOption {
    const {theme, timeSeries, previousTimeSeries, releaseSeries, additionalSeries} =
      this.props;
    const {seriesSelection} = this.state;

    const hideReleasesByDefault =
      (releaseSeries[0] as any)?.markLine?.data.length >= RELEASE_LINES_THRESHOLD;

    const hideHealthyByDefault = timeSeries
      .filter(s => sessionTerm.healthy !== s.seriesName)
      .some(s => s.data.some(d => d.value > 0));

    const selected =
      Object.keys(seriesSelection).length === 0 &&
      (hideReleasesByDefault || hideHealthyByDefault)
        ? {
            [t('Releases')]: !hideReleasesByDefault,
            [sessionTerm.healthy]: !hideHealthyByDefault,
          }
        : seriesSelection;

    return {
      right: 10,
      top: 0,
      icon: 'circle',
      itemHeight: 8,
      itemWidth: 8,
      itemGap: 12,
      align: 'left' as const,
      textStyle: {
        color: theme.textColor,
        verticalAlign: 'top',
        fontSize: 11,
        fontFamily: theme.text.family,
      },
      data: [
        ...timeSeries.map(s => s.seriesName),
        ...(previousTimeSeries ?? []).map(s => s.seriesName),
        ...(additionalSeries ?? []).map(s => s.name?.toString() ?? ''),
        ...releaseSeries.map(s => s.seriesName),
      ],
      selected,
    };
  }

  get chartOptions(): Omit<LineChartProps, 'series'> {
    return {
      grid: {left: '10px', right: '10px', top: '40px', bottom: '0px'},
      seriesOptions: {
        showSymbol: false,
      },
      tooltip: {
        trigger: 'axis',
        truncate: 80,
        valueFormatter: (value: number | null) => {
          if (value === null) {
            return '\u2014';
          }

          if (this.isCrashFree) {
            return displayCrashFreePercent(value, 0, 3);
          }

          if (this.isAnr) {
            return displayCrashFreePercent(value, 0, 3, false);
          }

          return typeof value === 'number' ? value.toLocaleString() : value;
        },
      },
      yAxis: this.isCrashFree
        ? {
            axisLabel: {
              formatter: (value: number) => displayCrashFreePercent(value),
            },
            scale: true,
            max: 100,
          }
        : this.isAnr
          ? {
              axisLabel: {
                formatter: (value: number) => displayCrashFreePercent(value, 0, 3, false),
              },
              scale: true,
            }
          : {min: 0},
    };
  }

  render() {
    const {
      zoomRenderProps,
      timeSeries,
      previousTimeSeries,
      releaseSeries,
      additionalSeries,
    } = this.props;

    const ChartComponent = this.isCrashFree
      ? LineChart
      : this.isAnr
        ? BarChart
        : StackedAreaChart;
    return (
      <ChartComponent
        {...zoomRenderProps}
        {...this.chartOptions}
        legend={this.legend}
        series={
          Array.isArray(releaseSeries) && !this.isAnr
            ? [...timeSeries, ...releaseSeries]
            : timeSeries
        }
        additionalSeries={additionalSeries}
        previousPeriod={previousTimeSeries}
        onLegendSelectChanged={this.handleLegendSelectChanged}
        minutesThresholdToDisplaySeconds={MINUTES_THRESHOLD_TO_DISPLAY_SECONDS}
        transformSinglePointToBar
      />
    );
  }
}

export default withPageFilters(ProjectBaseSessionsChart);

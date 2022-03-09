import {Component, Fragment} from 'react';
import {InjectedRouter} from 'react-router';
import {useTheme} from '@emotion/react';
import type {LegendComponentOption} from 'echarts';
import isEqual from 'lodash/isEqual';

import {Client} from 'sentry/api';
import ChartZoom, {ZoomRenderProps} from 'sentry/components/charts/chartZoom';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import LineChart from 'sentry/components/charts/lineChart';
import ReleaseSeries from 'sentry/components/charts/releaseSeries';
import StackedAreaChart from 'sentry/components/charts/stackedAreaChart';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {RELEASE_LINES_THRESHOLD} from 'sentry/components/charts/utils';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization, PageFilters} from 'sentry/types';
import {EChartEventHandler, Series} from 'sentry/types/echarts';
import getDynamicText from 'sentry/utils/getDynamicText';
import {MINUTES_THRESHOLD_TO_DISPLAY_SECONDS} from 'sentry/utils/sessions';
import {Theme} from 'sentry/utils/theme';
import withPageFilters from 'sentry/utils/withPageFilters';
import {displayCrashFreePercent} from 'sentry/views/releases/utils';
import {sessionTerm} from 'sentry/views/releases/utils/sessionTerm';

import {DisplayModes} from '../projectCharts';

import ProjectSessionsChartRequest from './projectSessionsChartRequest';

type Props = {
  api: Client;
  displayMode:
    | DisplayModes.SESSIONS
    | DisplayModes.STABILITY_USERS
    | DisplayModes.STABILITY;
  onTotalValuesChange: (value: number | null) => void;
  organization: Organization;
  router: InjectedRouter;
  selection: PageFilters;
  title: string;
  disablePrevious?: boolean;
  help?: string;
  query?: string;
};

function ProjectBaseSessionsChart({
  title,
  organization,
  router,
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

  return (
    <Fragment>
      {getDynamicText({
        value: (
          <ChartZoom router={router} period={period} start={start} end={end} utc={utc}>
            {zoomRenderProps => (
              <ProjectSessionsChartRequest
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
                          />
                        </TransitionChart>
                      );
                    }}
                  </ReleaseSeries>
                )}
              </ProjectSessionsChartRequest>
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
    | DisplayModes.STABILITY_USERS;
  releaseSeries: Series[];
  reloading: boolean;
  theme: Theme;
  timeSeries: Series[];
  zoomRenderProps: ZoomRenderProps;
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

  get legend(): LegendComponentOption {
    const {theme, timeSeries, previousTimeSeries, releaseSeries} = this.props;
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
        ...releaseSeries.map(s => s.seriesName),
      ],
      selected,
    };
  }

  get chartOptions() {
    return {
      grid: {left: '10px', right: '10px', top: '40px', bottom: '0px'},
      seriesOptions: {
        showSymbol: false,
      },
      tooltip: {
        trigger: 'axis' as const,
        truncate: 80,
        valueFormatter: (value: number | null) => {
          if (value === null) {
            return '\u2014';
          }

          if (this.isCrashFree) {
            return displayCrashFreePercent(value, 0, 3);
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
        : {min: 0},
    };
  }

  render() {
    const {zoomRenderProps, timeSeries, previousTimeSeries, releaseSeries} = this.props;

    const ChartComponent = this.isCrashFree ? LineChart : StackedAreaChart;

    return (
      <ChartComponent
        {...zoomRenderProps}
        {...this.chartOptions}
        legend={this.legend}
        series={
          Array.isArray(releaseSeries) ? [...timeSeries, ...releaseSeries] : timeSeries
        }
        previousPeriod={previousTimeSeries}
        onLegendSelectChanged={this.handleLegendSelectChanged}
        minutesThresholdToDisplaySeconds={MINUTES_THRESHOLD_TO_DISPLAY_SECONDS}
        transformSinglePointToBar
      />
    );
  }
}

export default withPageFilters(ProjectBaseSessionsChart);

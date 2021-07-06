import {Component, Fragment} from 'react';
import {InjectedRouter} from 'react-router/lib/Router';
import {withTheme} from '@emotion/react';
import isEqual from 'lodash/isEqual';

import {Client} from 'app/api';
import ChartZoom, {ZoomRenderProps} from 'app/components/charts/chartZoom';
import ErrorPanel from 'app/components/charts/errorPanel';
import LineChart from 'app/components/charts/lineChart';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import StackedAreaChart from 'app/components/charts/stackedAreaChart';
import {HeaderTitleLegend} from 'app/components/charts/styles';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import {RELEASE_LINES_THRESHOLD} from 'app/components/charts/utils';
import QuestionTooltip from 'app/components/questionTooltip';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import {GlobalSelection, Organization} from 'app/types';
import {EChartEventHandler, Series} from 'app/types/echarts';
import getDynamicText from 'app/utils/getDynamicText';
import {Theme} from 'app/utils/theme';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import {displayCrashFreePercent} from 'app/views/releases/utils';
import {sessionTerm} from 'app/views/releases/utils/sessionTerm';

import {DisplayModes} from '../projectCharts';

import SessionsRequest from './sessionsRequest';

type Props = {
  title: string;
  router: InjectedRouter;
  selection: GlobalSelection;
  api: Client;
  organization: Organization;
  theme: Theme;
  onTotalValuesChange: (value: number | null) => void;
  displayMode: DisplayModes.SESSIONS | DisplayModes.STABILITY;
  help?: string;
  disablePrevious?: boolean;
  query?: string;
};

function ProjectBaseSessionsChart({
  title,
  theme,
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
  const {projects, environments, datetime} = selection;
  const {start, end, period, utc} = datetime;

  return (
    <Fragment>
      {getDynamicText({
        value: (
          <ChartZoom router={router} period={period} start={start} end={end} utc={utc}>
            {zoomRenderProps => (
              <SessionsRequest
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
              </SessionsRequest>
            )}
          </ChartZoom>
        ),
        fixed: `${title} Chart`,
      })}
    </Fragment>
  );
}

type ChartProps = {
  theme: Theme;
  zoomRenderProps: ZoomRenderProps;
  reloading: boolean;
  timeSeries: Series[];
  releaseSeries: Series[];
  previousTimeSeries?: Series[];
  displayMode: DisplayModes.SESSIONS | DisplayModes.STABILITY;
};

type ChartState = {
  seriesSelection: Record<string, boolean>;
  forceUpdate: boolean;
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

  get legend() {
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
    const {theme, displayMode} = this.props;

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

          if (displayMode === DisplayModes.STABILITY) {
            return displayCrashFreePercent(value, 0, 3);
          }

          return typeof value === 'number' ? value.toLocaleString() : value;
        },
      },
      yAxis:
        displayMode === DisplayModes.STABILITY
          ? {
              axisLabel: {
                color: theme.gray200,
                formatter: (value: number) => displayCrashFreePercent(value),
              },
              scale: true,
              max: 100,
            }
          : {min: 0},
    };
  }

  render() {
    const {zoomRenderProps, timeSeries, previousTimeSeries, releaseSeries, displayMode} =
      this.props;

    const ChartComponent =
      displayMode === DisplayModes.STABILITY ? LineChart : StackedAreaChart;

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
        transformSinglePointToBar
      />
    );
  }
}

export default withGlobalSelection(withTheme(ProjectBaseSessionsChart));

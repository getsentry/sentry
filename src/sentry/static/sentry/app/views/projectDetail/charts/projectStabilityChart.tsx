import React from 'react';
import {InjectedRouter} from 'react-router/lib/Router';
import {withTheme} from 'emotion-theming';
import isEqual from 'lodash/isEqual';

import {Client} from 'app/api';
import ChartZoom, {ZoomRenderProps} from 'app/components/charts/chartZoom';
import ErrorPanel from 'app/components/charts/errorPanel';
import LineChart from 'app/components/charts/lineChart';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import QuestionTooltip from 'app/components/questionTooltip';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import {GlobalSelection, Organization} from 'app/types';
import {EChartEventHandler, Series} from 'app/types/echarts';
import getDynamicText from 'app/utils/getDynamicText';
import {Theme} from 'app/utils/theme';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import {HeaderTitleLegend} from 'app/views/performance/styles';
import {displayCrashFreePercent} from 'app/views/releases/utils';
import {
  getSessionTermDescription,
  SessionTerm,
} from 'app/views/releases/utils/sessionTerm';

import SessionsRequest from './sessionsRequest';

type Props = {
  router: InjectedRouter;
  selection: GlobalSelection;
  api: Client;
  organization: Organization;
  theme: Theme;
  onTotalValuesChange: (value: number | null) => void;
};

function ProjectStabilityChart({
  theme,
  organization,
  router,
  selection,
  api,
  onTotalValuesChange,
}: Props) {
  const {projects, environments, datetime} = selection;
  const {start, end, period, utc} = datetime;

  return (
    <React.Fragment>
      {getDynamicText({
        value: (
          <ChartZoom router={router} period={period} start={start} end={end} utc={utc}>
            {zoomRenderProps => (
              <SessionsRequest
                api={api}
                selection={selection}
                organization={organization}
              >
                {({
                  errored,
                  loading,
                  reloading,
                  timeseriesData,
                  previousTimeseriesData,
                  totalSessions,
                }) => (
                  <ReleaseSeries
                    utc={utc}
                    period={period}
                    start={start}
                    end={end}
                    projects={projects}
                    environments={environments}
                  >
                    {({releaseSeries}) => {
                      if (errored) {
                        return (
                          <ErrorPanel>
                            <IconWarning color="gray300" size="lg" />
                          </ErrorPanel>
                        );
                      }

                      onTotalValuesChange(totalSessions);

                      if (totalSessions === 0) {
                        return <ErrorPanel>{t('No session data')}</ErrorPanel>;
                      }

                      return (
                        <TransitionChart loading={loading} reloading={reloading}>
                          <TransparentLoadingMask visible={reloading} />

                          <HeaderTitleLegend>
                            {t('Crash Free Rate')}
                            <QuestionTooltip
                              size="sm"
                              position="top"
                              title={getSessionTermDescription(
                                SessionTerm.STABILITY,
                                null
                              )}
                            />
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
        fixed: t('Crash Free Rate Chart'),
      })}
    </React.Fragment>
  );
}

type ChartProps = {
  theme: Theme;
  zoomRenderProps: ZoomRenderProps;
  reloading: boolean;
  timeSeries: Series[];
  releaseSeries: Series[];
  previousTimeSeries?: Series[];
};

type ChartState = {
  seriesSelection: Record<string, boolean>;
  forceUpdate: boolean;
};

class Chart extends React.Component<ChartProps, ChartState> {
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
    const {theme} = this.props;
    const {seriesSelection} = this.state;

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
      data: [t('This Period'), t('Previous Period'), t('Releases')],
      selected: seriesSelection,
    };
  }

  get chartOptions() {
    const {theme} = this.props;

    return {
      colors: [theme.green300, theme.purple200],
      grid: {left: '10px', right: '10px', top: '40px', bottom: '0px'},
      seriesOptions: {
        showSymbol: false,
      },
      tooltip: {
        trigger: 'axis' as const,
        truncate: 80,
        valueFormatter: (value: number) => displayCrashFreePercent(value, 0, 3),
      },
      yAxis: {
        axisLabel: {
          color: theme.gray200,
          formatter: (value: number) => `${value.toFixed(value === 100 ? 0 : 2)}%`,
        },
        scale: true,
        max: 100,
      },
    };
  }

  render() {
    const {zoomRenderProps, timeSeries, previousTimeSeries, releaseSeries} = this.props;

    return (
      <LineChart
        {...zoomRenderProps}
        {...this.chartOptions}
        legend={this.legend}
        series={
          Array.isArray(releaseSeries) ? [...timeSeries, ...releaseSeries] : timeSeries
        }
        previousPeriod={previousTimeSeries}
        onLegendSelectChanged={this.handleLegendSelectChanged}
      />
    );
  }
}

export default withGlobalSelection(withTheme(ProjectStabilityChart));

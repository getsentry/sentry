import React from 'react';
import * as ReactRouter from 'react-router';

import ChartZoom from 'app/components/charts/chartZoom';
import {IconWarning} from 'app/icons';
import {GlobalSelection} from 'app/types';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import ErrorPanel from 'app/components/charts/errorPanel';

import HealthChart from './healthChart';
import {YAxis} from './releaseChartControls';
import {ReleaseStatsRequestRenderProps} from '../releaseStatsRequest';

type Props = Omit<
  ReleaseStatsRequestRenderProps,
  'crashFreeTimeBreakdown' | 'chartSummary'
> & {
  selection: GlobalSelection;
  yAxis: YAxis;
  router: ReactRouter.InjectedRouter;
};

type State = {
  shouldRecalculateVisibleSeries: boolean;
};

class ReleaseChartContainer extends React.Component<Props, State> {
  state = {
    shouldRecalculateVisibleSeries: true,
  };

  handleVisibleSeriesRecalculated = () => {
    this.setState({shouldRecalculateVisibleSeries: false});
  };

  render() {
    const {loading, errored, reloading, chartData, selection, yAxis, router} = this.props;
    const {shouldRecalculateVisibleSeries} = this.state;
    const {datetime} = selection;
    const {utc, period, start, end} = datetime;

    return (
      <React.Fragment>
        <ChartZoom router={router} period={period} utc={utc} start={start} end={end}>
          {zoomRenderProps => {
            if (errored) {
              return (
                <ErrorPanel>
                  <IconWarning color="gray500" size="lg" />
                </ErrorPanel>
              );
            }

            return (
              <TransitionChart loading={loading} reloading={reloading}>
                <TransparentLoadingMask visible={reloading} />
                <HealthChart
                  utc={utc}
                  timeseriesData={chartData}
                  zoomRenderProps={zoomRenderProps}
                  reloading={reloading}
                  yAxis={yAxis}
                  location={router.location}
                  shouldRecalculateVisibleSeries={shouldRecalculateVisibleSeries}
                  onVisibleSeriesRecalculated={this.handleVisibleSeriesRecalculated}
                />
              </TransitionChart>
            );
          }}
        </ChartZoom>
      </React.Fragment>
    );
  }
}

export default ReleaseChartContainer;

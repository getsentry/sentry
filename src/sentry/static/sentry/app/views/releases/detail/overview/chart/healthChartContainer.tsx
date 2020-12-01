import React from 'react';
import * as ReactRouter from 'react-router';

import ChartZoom from 'app/components/charts/chartZoom';
import ErrorPanel from 'app/components/charts/errorPanel';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import {PlatformKey} from 'app/data/platformCategories';
import {IconWarning} from 'app/icons';
import {GlobalSelection} from 'app/types';

import {ReleaseStatsRequestRenderProps} from '../releaseStatsRequest';

import HealthChart from './healthChart';
import {YAxis} from './releaseChartControls';

type Props = Omit<
  ReleaseStatsRequestRenderProps,
  'crashFreeTimeBreakdown' | 'chartSummary'
> & {
  selection: GlobalSelection;
  yAxis: YAxis;
  router: ReactRouter.InjectedRouter;
  platform: PlatformKey;
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
    const {
      loading,
      errored,
      reloading,
      chartData,
      selection,
      yAxis,
      router,
      platform,
    } = this.props;
    const {shouldRecalculateVisibleSeries} = this.state;
    const {datetime} = selection;
    const {utc, period, start, end} = datetime;

    return (
      <ChartZoom router={router} period={period} utc={utc} start={start} end={end}>
        {zoomRenderProps => {
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
              <HealthChart
                utc={utc}
                timeseriesData={chartData}
                zoomRenderProps={zoomRenderProps}
                reloading={reloading}
                yAxis={yAxis}
                location={router.location}
                shouldRecalculateVisibleSeries={shouldRecalculateVisibleSeries}
                onVisibleSeriesRecalculated={this.handleVisibleSeriesRecalculated}
                platform={platform}
              />
            </TransitionChart>
          );
        }}
      </ChartZoom>
    );
  }
}

export default ReleaseChartContainer;

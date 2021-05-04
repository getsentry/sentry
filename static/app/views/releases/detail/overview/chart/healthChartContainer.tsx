import {Component} from 'react';
import * as ReactRouter from 'react-router';

import ChartZoom from 'app/components/charts/chartZoom';
import ErrorPanel from 'app/components/charts/errorPanel';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import {PlatformKey} from 'app/data/platformCategories';
import {IconWarning} from 'app/icons';
import {GlobalSelection} from 'app/types';
import {sessionTerm} from 'app/views/releases/utils/sessionTerm';

import {ReleaseStatsRequestRenderProps} from '../releaseStatsRequest';

import HealthChart from './healthChart';
import {YAxis} from './releaseChartControls';
import {sortSessionSeries} from './utils';

type Props = Omit<
  ReleaseStatsRequestRenderProps,
  'crashFreeTimeBreakdown' | 'chartSummary'
> & {
  selection: GlobalSelection;
  yAxis: YAxis;
  router: ReactRouter.InjectedRouter;
  platform: PlatformKey;
  title: string;
  help?: string;
};

type State = {
  shouldRecalculateVisibleSeries: boolean;
};

class ReleaseChartContainer extends Component<Props, State> {
  state: State = {
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
      title,
      help,
    } = this.props;
    const {shouldRecalculateVisibleSeries} = this.state;
    const {datetime} = selection;
    const {utc, period, start, end} = datetime;

    const timeseriesData = chartData.filter(({seriesName}) => {
      // There is no concept of Abnormal sessions in javascript
      if (
        (seriesName === sessionTerm.abnormal ||
          seriesName === sessionTerm.otherAbnormal) &&
        ['javascript', 'node'].includes(platform)
      ) {
        return false;
      }

      return true;
    });

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
                timeseriesData={timeseriesData.sort(sortSessionSeries)}
                zoomRenderProps={zoomRenderProps}
                reloading={reloading}
                yAxis={yAxis}
                location={router.location}
                shouldRecalculateVisibleSeries={shouldRecalculateVisibleSeries}
                onVisibleSeriesRecalculated={this.handleVisibleSeriesRecalculated}
                platform={platform}
                title={title}
                help={help}
              />
            </TransitionChart>
          );
        }}
      </ChartZoom>
    );
  }
}

export default ReleaseChartContainer;

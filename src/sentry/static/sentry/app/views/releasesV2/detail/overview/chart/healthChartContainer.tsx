import React from 'react';
import * as ReactRouter from 'react-router';

import ChartZoom from 'app/components/charts/chartZoom';
import {IconWarning} from 'app/icons';
import theme from 'app/utils/theme';
import {GlobalSelection} from 'app/types';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/components/transparentLoadingMask';
import ErrorPanel from 'app/components/charts/components/errorPanel';

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

const ReleaseChartContainer = ({
  loading,
  errored,
  reloading,
  chartData,
  selection,
  yAxis,
  router,
}: Props) => {
  const {datetime} = selection;
  const {utc, period, start, end} = datetime;

  return (
    <React.Fragment>
      <ChartZoom router={router} period={period} utc={utc} start={start} end={end}>
        {zoomRenderProps => {
          if (errored) {
            return (
              <ErrorPanel>
                <IconWarning color={theme.gray2} size="lg" />
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
              />
            </TransitionChart>
          );
        }}
      </ChartZoom>
    </React.Fragment>
  );
};

export default ReleaseChartContainer;

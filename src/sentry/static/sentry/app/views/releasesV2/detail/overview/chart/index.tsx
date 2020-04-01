import React from 'react';
import styled from '@emotion/styled';
import * as ReactRouter from 'react-router';

import ChartZoom from 'app/components/charts/chartZoom';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import {IconWarning} from 'app/icons';
import theme from 'app/utils/theme';
import {GlobalSelection} from 'app/types';
import TransitionChart from 'app/components/charts/transitionChart';
import {Panel} from 'app/components/panels';
import TransparentLoadingMask from 'app/components/charts/components/transparentLoadingMask';
import ErrorPanel from 'app/components/charts/components/errorPanel';
import space from 'app/styles/space';

import ReleaseChart from './releaseChart';
import ReleaseChartControls, {YAxis} from './releaseChartControls';
import {ReleaseStatsRequestRenderProps} from './releaseStatsRequest';

type Props = Omit<ReleaseStatsRequestRenderProps, 'crashFreeTimeBreakdown'> & {
  selection: GlobalSelection;
  yAxis: YAxis;
  onYAxisChange: (yAxis: YAxis) => void;
  router: ReactRouter.InjectedRouter;
};

const ReleaseChartContainer = ({
  selection,
  loading,
  errored,
  reloading,
  chartData,
  chartSummary,
  yAxis,
  onYAxisChange,
  router,
}: Props) => {
  const {datetime, projects} = selection;
  const {utc, period, start, end} = datetime;

  return (
    <Panel>
      <ChartWrapper>
        <ChartZoom router={router} period={period} utc={utc} start={start} end={end}>
          {zoomRenderProps => (
            <ReleaseSeries utc={utc} projects={projects}>
              {({releaseSeries}) => {
                if (errored) {
                  return (
                    <ErrorPanel>
                      <IconWarning color={theme.gray2} size="lg" />
                    </ErrorPanel>
                  );
                }

                return (
                  <TransitionChart loading={loading} reloading={reloading}>
                    <React.Fragment>
                      <TransparentLoadingMask visible={reloading} />
                      <ReleaseChart
                        utc={utc}
                        releaseSeries={releaseSeries}
                        timeseriesData={chartData}
                        zoomRenderProps={zoomRenderProps}
                        reloading={reloading}
                        yAxis={yAxis}
                      />
                    </React.Fragment>
                  </TransitionChart>
                );
              }}
            </ReleaseSeries>
          )}
        </ChartZoom>
      </ChartWrapper>
      <ReleaseChartControls
        summary={chartSummary}
        yAxis={yAxis}
        onYAxisChange={onYAxisChange}
      />
    </Panel>
  );
};

const ChartWrapper = styled('div')`
  padding: ${space(1)} ${space(2)};
`;

export default ReleaseChartContainer;

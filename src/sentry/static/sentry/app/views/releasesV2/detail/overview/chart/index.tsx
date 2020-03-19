import React from 'react';
import {InjectedRouter} from 'react-router/lib/Router';
import {Location} from 'history';
import styled from '@emotion/styled';

// import ChartZoom from 'app/components/charts/chartZoom';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import {Client} from 'app/api';
import {IconWarning} from 'app/icons';
import theme from 'app/utils/theme';
import withApi from 'app/utils/withApi';
import {GlobalSelection} from 'app/types';
import TransitionChart from 'app/components/charts/transitionChart';
import {Panel} from 'app/components/panels';
import TransparentLoadingMask from 'app/components/charts/components/transparentLoadingMask';
import ErrorPanel from 'app/components/charts/components/errorPanel';
import space from 'app/styles/space';

import ReleaseChart from './releaseChart';
import ReleaseChartRequest from './releaseChartRequest';
import ReleaseChartControls from './releaseChartControls';

export type YAxis = 'sessions' | 'users' | 'crashFree';

type Props = {
  api: Client;
  router: InjectedRouter;
  location: Location;
  selection: GlobalSelection;
  version: string;
  orgId: string;
  projectSlug: string;
};

type State = {
  summary: React.ReactNode;
  yAxis: YAxis;
};

class ReleaseChartContainer extends React.Component<Props, State> {
  state: State = {
    summary: '',
    yAxis: 'sessions',
  };

  handleYAxisChange = (value: YAxis) => {
    this.setState({yAxis: value});
  };

  handleSummaryChange = (value: React.ReactNode) => {
    this.setState({summary: value});
  };

  render() {
    const {api, location, selection, version, orgId, projectSlug} = this.props;
    const {summary, yAxis} = this.state;
    const {datetime, projects} = selection;
    const {utc} = datetime;

    return (
      <Panel>
        <ChartWrapper>
          {/* <ChartZoom router={router} period={period} utc={utc} start={start} end={end}>
        {zoomRenderProps => ( */}
          <ReleaseChartRequest
            api={api}
            orgId={orgId}
            projectSlug={projectSlug}
            version={version}
            selection={selection}
            location={location}
            yAxis={yAxis}
            onSummaryChange={this.handleSummaryChange}
          >
            {({loading, reloading, errored, timeseriesData}) => (
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
                          timeseriesData={timeseriesData}
                          // zoomRenderProps={zoomRenderProps}
                          reloading={reloading}
                          yAxis={yAxis}
                        />
                      </React.Fragment>
                    </TransitionChart>
                  );
                }}
              </ReleaseSeries>
            )}
          </ReleaseChartRequest>
          {/*   )}
       </ChartZoom> */}
        </ChartWrapper>

        <ReleaseChartControls
          summary={summary}
          yAxis={yAxis}
          onYAxisChange={this.handleYAxisChange}
        />
      </Panel>
    );
  }
}

const ChartWrapper = styled('div')`
  padding: ${space(1)} ${space(2)};
`;

export default withApi(ReleaseChartContainer);

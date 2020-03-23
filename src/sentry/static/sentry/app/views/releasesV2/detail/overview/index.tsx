import React from 'react';
import styled from '@emotion/styled';
import {Params, InjectedRouter} from 'react-router/lib/Router';
import {Location} from 'history';

import withOrganization from 'app/utils/withOrganization';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import {Organization, GlobalSelection} from 'app/types';
import space from 'app/styles/space';
import {Client} from 'app/api';
import withApi from 'app/utils/withApi';

import ReleaseChartContainer from './chart';
import Issues from './issues';
import CommitAuthorBreakdown from './commitAuthorBreakdown';
import ProjectReleaseDetails from './projectReleaseDetails';
import TotalCrashFreeUsers from './totalCrashFreeUsers';
import ReleaseStatsRequest from './chart/releaseStatsRequest';
import {YAxis} from './chart/releaseChartControls';

import {ReleaseContext} from '..';

type Props = {
  organization: Organization;
  params: Params;
  location: Location;
  selection: GlobalSelection;
  router: InjectedRouter;
  api: Client;
};

type State = {
  yAxis: YAxis;
};

class ReleaseOverview extends React.Component<Props, State> {
  state: State = {
    yAxis: 'sessions',
  };

  handleYAxisChange = (yAxis: YAxis) => {
    this.setState({yAxis});
  };

  render() {
    const {organization, params, selection, location, api, router} = this.props;
    const {yAxis} = this.state;

    return (
      <ReleaseContext.Consumer>
        {({release, project}) => {
          const {commitCount, version} = release;
          const {hasHealthData} = project.healthData || {};

          return (
            <ReleaseStatsRequest
              api={api}
              orgId={organization.slug}
              projectSlug={project.slug}
              version={version}
              selection={selection}
              location={location}
              yAxis={yAxis}
            >
              {({crashFreeTimeBreakdown, ...releaseStatsProps}) => (
                <ContentBox>
                  <Main>
                    {hasHealthData && (
                      <ReleaseChartContainer
                        onYAxisChange={this.handleYAxisChange}
                        selection={selection}
                        yAxis={yAxis}
                        router={router}
                        {...releaseStatsProps}
                      />
                    )}
                    <Issues
                      orgId={organization.slug}
                      projectId={project.id}
                      version={params.release}
                    />
                  </Main>
                  <Sidebar>
                    {commitCount > 0 && (
                      <CommitAuthorBreakdown
                        version={version}
                        orgId={organization.slug}
                        projectSlug={project.slug}
                      />
                    )}
                    <ProjectReleaseDetails release={release} />
                    {hasHealthData && (
                      <TotalCrashFreeUsers
                        crashFreeTimeBreakdown={crashFreeTimeBreakdown}
                        startDate={release.dateReleased ?? release.dateCreated}
                      />
                    )}
                    {/* TODO(releasesV2): hidden for now */}
                    {/* <SessionDuration /> */}
                  </Sidebar>
                </ContentBox>
              )}
            </ReleaseStatsRequest>
          );
        }}
      </ReleaseContext.Consumer>
    );
  }
}

const ContentBox = styled('div')`
  padding: ${space(4)};
  flex: 1;
  background-color: white;

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    display: grid;
    grid-column-gap: ${space(3)};
    grid-template-columns: minmax(470px, 1fr) minmax(220px, 280px);
  }
`;

const Main = styled('div')`
  grid-column: 1 / 2;
`;
const Sidebar = styled('div')`
  grid-column: 2 / 3;
`;

export default withApi(withGlobalSelection(withOrganization(ReleaseOverview)));

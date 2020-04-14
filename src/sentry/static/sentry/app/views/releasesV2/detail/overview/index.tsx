import React from 'react';
import styled from '@emotion/styled';
import {RouteComponentProps} from 'react-router/lib/Router';

import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import withOrganization from 'app/utils/withOrganization';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import {Organization, GlobalSelection} from 'app/types';
import space from 'app/styles/space';
import {Client} from 'app/api';
import withApi from 'app/utils/withApi';
import {formatVersion} from 'app/utils/formatters';
import routeTitleGen from 'app/utils/routeTitle';

import ReleaseChart from './chart/';
import Issues from './issues';
import CommitAuthorBreakdown from './commitAuthorBreakdown';
import ProjectReleaseDetails from './projectReleaseDetails';
import TotalCrashFreeUsers from './totalCrashFreeUsers';
import ReleaseStatsRequest from './releaseStatsRequest';
import {YAxis} from './chart/releaseChartControls';

import {ReleaseContext} from '..';

type RouteParams = {
  orgId: string;
  release: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  selection: GlobalSelection;
  api: Client;
};

class ReleaseOverview extends AsyncView<Props> {
  getTitle() {
    const {params, organization} = this.props;
    return routeTitleGen(
      t('Release %s', formatVersion(params.release)),
      organization.slug,
      false
    );
  }

  handleYAxisChange = (yAxis: YAxis) => {
    const {location, router} = this.props;

    router.push({
      ...location,
      query: {...location.query, yAxis},
    });
  };

  getYAxis(hasHealthData: boolean): YAxis {
    const {yAxis} = this.props.location.query;

    if (typeof yAxis === 'string') {
      return yAxis as YAxis;
    }

    if (hasHealthData) {
      return YAxis.SESSIONS;
    }

    return YAxis.EVENTS;
  }

  render() {
    const {organization, selection, location, api, router} = this.props;

    return (
      <ReleaseContext.Consumer>
        {({release, project}) => {
          const {commitCount, version} = release;
          const {hasHealthData} = project.healthData || {};
          const hasDiscover = organization.features.includes('discover-basic');
          const yAxis = this.getYAxis(hasHealthData);

          return (
            <ReleaseStatsRequest
              api={api}
              orgId={organization.slug}
              projectSlug={project.slug}
              version={version}
              selection={selection}
              location={location}
              yAxis={yAxis}
              disable={!hasHealthData && !hasDiscover}
            >
              {({crashFreeTimeBreakdown, ...releaseStatsProps}) => (
                <ContentBox>
                  <Main>
                    {(hasDiscover || hasHealthData) && (
                      <ReleaseChart
                        {...releaseStatsProps}
                        selection={selection}
                        yAxis={yAxis}
                        onYAxisChange={this.handleYAxisChange}
                        router={router}
                        organization={organization}
                        hasHealthData={hasHealthData}
                        location={location}
                        api={api}
                        version={version}
                        hasDiscover={hasDiscover}
                      />
                    )}

                    <Issues
                      orgId={organization.slug}
                      selection={selection}
                      version={version}
                      location={location}
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
                      />
                    )}
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

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
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

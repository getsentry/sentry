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
import Feature from 'app/components/acl/feature';

import ReleaseChartContainer from './chart';
import Issues from './issues';
import CommitAuthorBreakdown from './commitAuthorBreakdown';
import ProjectReleaseDetails from './projectReleaseDetails';
import TotalCrashFreeUsers from './totalCrashFreeUsers';
import ReleaseStatsRequest from './chart/releaseStatsRequest';
import {YAxis} from './chart/releaseChartControls';
import DiscoverChartContainer from './chart/discoverChartContainer';
import SwitchReleasesButton from '../../utils/switchReleasesButton';

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

  getYAxis(): YAxis {
    const {yAxis} = this.props.location.query;

    return typeof yAxis === 'string' ? (yAxis as YAxis) : YAxis.SESSIONS;
  }

  render() {
    const {organization, selection, location, api, router} = this.props;
    const yAxis = this.getYAxis();

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
              disable={!hasHealthData}
            >
              {({crashFreeTimeBreakdown, ...releaseStatsProps}) => (
                <ContentBox>
                  <Main>
                    {hasHealthData ? (
                      <ReleaseChartContainer
                        onYAxisChange={this.handleYAxisChange}
                        selection={selection}
                        yAxis={yAxis}
                        router={router}
                        {...releaseStatsProps}
                      />
                    ) : (
                      <Feature features={['discover-basic']}>
                        <DiscoverChartContainer
                          organization={organization}
                          selection={selection}
                          location={location}
                          api={api}
                          router={router}
                          version={version}
                        />
                      </Feature>
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

                  <SwitchReleasesButton version="1" orgId={organization.id} />
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

import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import withOrganization from 'app/utils/withOrganization';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import {Organization, GlobalSelection} from 'app/types';
import {Client} from 'app/api';
import withApi from 'app/utils/withApi';
import {formatVersion} from 'app/utils/formatters';
import routeTitleGen from 'app/utils/routeTitle';
import {Body, Main, Side} from 'app/components/layouts/thirds';

import ReleaseChart from './chart/';
import Issues from './issues';
import CommitAuthorBreakdown from './commitAuthorBreakdown';
import ProjectReleaseDetails from './projectReleaseDetails';
import OtherProjects from './otherProjects';
import TotalCrashFreeUsers from './totalCrashFreeUsers';
import Deploys from './deploys';
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
        {({release, project, deploys, releaseMeta}) => {
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
              hasHealthData={hasHealthData}
              hasDiscover={hasDiscover}
            >
              {({crashFreeTimeBreakdown, ...releaseStatsProps}) => (
                <StyledBody>
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
                  <Side>
                    <ProjectReleaseDetails
                      release={release}
                      releaseMeta={releaseMeta}
                      orgSlug={organization.slug}
                      projectSlug={project.slug}
                    />
                    {commitCount > 0 && (
                      <CommitAuthorBreakdown
                        version={version}
                        orgId={organization.slug}
                        projectSlug={project.slug}
                      />
                    )}
                    {releaseMeta.projects.length > 1 && (
                      <OtherProjects
                        projects={releaseMeta.projects.filter(
                          p => p.slug !== project.slug
                        )}
                        location={location}
                      />
                    )}
                    {hasHealthData && (
                      <TotalCrashFreeUsers
                        crashFreeTimeBreakdown={crashFreeTimeBreakdown}
                      />
                    )}
                    {deploys.length > 0 && (
                      <Deploys
                        version={version}
                        orgSlug={organization.slug}
                        deploys={deploys}
                        projectId={project.id}
                      />
                    )}
                  </Side>
                </StyledBody>
              )}
            </ReleaseStatsRequest>
          );
        }}
      </ReleaseContext.Consumer>
    );
  }
}

export default withApi(withGlobalSelection(withOrganization(ReleaseOverview)));

const StyledBody = styled(Body)`
  margin: -${space(2)} -${space(4)};
`;

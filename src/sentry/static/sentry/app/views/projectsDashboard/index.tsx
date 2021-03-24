import React from 'react';
import LazyLoad from 'react-lazyload';
import {Link, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {withProfiler} from '@sentry/react';
import flatten from 'lodash/flatten';
import uniqBy from 'lodash/uniqBy';

import {Client} from 'app/api';
import Button from 'app/components/button';
import IdBadge from 'app/components/idBadge';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import NoProjectMessage from 'app/components/noProjectMessage';
import PageHeading from 'app/components/pageHeading';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {IconAdd} from 'app/icons';
import {t} from 'app/locale';
import ProjectsStatsStore from 'app/stores/projectsStatsStore';
import space from 'app/styles/space';
import {Organization, TeamWithProjects} from 'app/types';
import {sortProjects} from 'app/utils';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import withTeamsForUser from 'app/utils/withTeamsForUser';

import Resources from './resources';
import TeamSection from './teamSection';

type Props = {
  api: Client;
  organization: Organization;
  teams: TeamWithProjects[];
  loadingTeams: boolean;
  error: Error | null;
} & RouteComponentProps<{orgId: string}, {}>;

class Dashboard extends React.Component<Props> {
  componentWillUnmount() {
    ProjectsStatsStore.reset();
  }

  render() {
    const {teams, params, organization, loadingTeams, error} = this.props;

    if (loadingTeams) {
      return <LoadingIndicator />;
    }

    if (error) {
      return <LoadingError message="An error occurred while fetching your projects" />;
    }

    const filteredTeams = teams.filter(team => team.projects.length);
    filteredTeams.sort((team1, team2) => team1.slug.localeCompare(team2.slug));

    const projects = uniqBy(flatten(teams.map(teamObj => teamObj.projects)), 'id');
    const favorites = projects.filter(project => project.isBookmarked);

    const access = new Set(organization.access);
    const canCreateProjects = access.has('project:admin');
    const hasTeamAdminAccess = access.has('team:admin');

    const showEmptyMessage = projects.length === 0 && favorites.length === 0;
    const showResources = projects.length === 1 && !projects[0].firstEvent;

    if (showEmptyMessage) {
      return (
        <NoProjectMessage
          organization={organization}
          projects={projects}
          superuserNeedsToBeProjectMember
        >
          {null}
        </NoProjectMessage>
      );
    }

    return (
      <React.Fragment>
        <SentryDocumentTitle
          title={t('Projects Dashboard')}
          orgSlug={organization.slug}
        />
        {projects.length > 0 && (
          <ProjectsHeader>
            <PageHeading>Projects</PageHeading>
            <Button
              size="small"
              disabled={!canCreateProjects}
              title={
                !canCreateProjects
                  ? t('You do not have permission to create projects')
                  : undefined
              }
              to={`/organizations/${organization.slug}/projects/new/`}
              icon={<IconAdd size="xs" isCircled />}
              data-test-id="create-project"
            >
              {t('Create Project')}
            </Button>
          </ProjectsHeader>
        )}

        {filteredTeams.map((team, index) => {
          const showBorder = index !== teams.length - 1;
          return (
            <LazyLoad key={team.slug} once debounce={50} height={300} offset={300}>
              <TeamSection
                orgId={params.orgId}
                team={team}
                showBorder={showBorder}
                title={
                  hasTeamAdminAccess ? (
                    <TeamLink to={`/settings/${organization.slug}/teams/${team.slug}/`}>
                      <IdBadge team={team} avatarSize={22} />
                    </TeamLink>
                  ) : (
                    <IdBadge team={team} avatarSize={22} />
                  )
                }
                projects={sortProjects(team.projects)}
                access={access}
              />
            </LazyLoad>
          );
        })}

        {showResources && <Resources organization={organization} />}
      </React.Fragment>
    );
  }
}

const OrganizationDashboard = (props: Props) => (
  <OrganizationDashboardWrapper>
    <Dashboard {...props} />
  </OrganizationDashboardWrapper>
);

const TeamLink = styled(Link)`
  display: flex;
  align-items: center;
`;

const ProjectsHeader = styled('div')`
  padding: ${space(3)} ${space(4)} 0 ${space(4)};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const OrganizationDashboardWrapper = styled('div')`
  display: flex;
  flex: 1;
  flex-direction: column;
`;

export {Dashboard};
export default withApi(
  withOrganization(withTeamsForUser(withProfiler(OrganizationDashboard)))
);

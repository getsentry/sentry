import {Fragment, useEffect} from 'react';
import LazyLoad from 'react-lazyload';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {withProfiler} from '@sentry/react';
import flatten from 'lodash/flatten';
import uniqBy from 'lodash/uniqBy';

import {Client} from 'sentry/api';
import Button from 'sentry/components/button';
import IdBadge from 'sentry/components/idBadge';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageHeading from 'sentry/components/pageHeading';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import ProjectsStatsStore from 'sentry/stores/projectsStatsStore';
import space from 'sentry/styles/space';
import {Organization, TeamWithProjects} from 'sentry/types';
import {sortProjects} from 'sentry/utils';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withTeamsForUser from 'sentry/utils/withTeamsForUser';

import Resources from './resources';
import TeamSection from './teamSection';

type Props = {
  api: Client;
  error: Error | null;
  loadingTeams: boolean;
  organization: Organization;
  teams: TeamWithProjects[];
} & RouteComponentProps<{orgId: string}, {}>;

function Dashboard({teams, params, organization, loadingTeams, error}: Props) {
  useEffect(() => {
    return function cleanup() {
      ProjectsStatsStore.reset();
    };
  }, []);

  if (loadingTeams) {
    return <LoadingIndicator />;
  }

  if (error) {
    return <LoadingError message={t('An error occurred while fetching your projects')} />;
  }

  const filteredTeams = teams.filter(team => team.projects.length);
  filteredTeams.sort((team1, team2) => team1.slug.localeCompare(team2.slug));

  const projects = uniqBy(flatten(teams.map(teamObj => teamObj.projects)), 'id');
  const favorites = projects.filter(project => project.isBookmarked);

  const canCreateProjects = organization.access.includes('project:admin');
  const hasTeamAdminAccess = organization.access.includes('team:admin');

  const showEmptyMessage = projects.length === 0 && favorites.length === 0;
  const showResources = projects.length === 1 && !projects[0].firstEvent;

  if (showEmptyMessage) {
    return (
      <NoProjectMessage organization={organization} superuserNeedsToBeProjectMember />
    );
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Projects Dashboard')} orgSlug={organization.slug} />
      {projects.length > 0 && (
        <Fragment>
          <ProjectsHeader>
            <PageHeading>{t('Projects')}</PageHeading>
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
        </Fragment>
      )}

      {filteredTeams.map((team, index) => (
        <LazyLoad key={team.slug} once debounce={50} height={300} offset={300}>
          <TeamSection
            orgId={params.orgId}
            team={team}
            showBorder={index !== teams.length - 1}
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
            access={new Set(organization.access)}
          />
        </LazyLoad>
      ))}
      {showResources && <Resources organization={organization} />}
    </Fragment>
  );
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

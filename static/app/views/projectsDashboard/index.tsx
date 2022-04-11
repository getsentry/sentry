import {Fragment, useCallback, useEffect, useState} from 'react';
import LazyLoad from 'react-lazyload';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {withProfiler} from '@sentry/react';
import debounce from 'lodash/debounce';
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
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {IconAdd, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import ProjectsStatsStore from 'sentry/stores/projectsStatsStore';
import space from 'sentry/styles/space';
import {Organization, TeamWithProjects} from 'sentry/types';
import {sortProjects} from 'sentry/utils';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withTeamsForUser from 'sentry/utils/withTeamsForUser';
import TeamFilter from 'sentry/views/alerts/rules/teamFilter';

import ProjectCard from './projectCard';
import Resources from './resources';
import TeamSection from './teamSection';
import {getTeamParams} from './utils';

type Props = {
  api: Client;
  error: Error | null;
  loadingTeams: boolean;
  organization: Organization;
  teams: TeamWithProjects[];
} & RouteComponentProps<{orgId: string}, {}>;

function Dashboard({
  teams,
  params,
  organization,
  loadingTeams,
  error,
  router,
  location,
}: Props) {
  useEffect(() => {
    return function cleanup() {
      ProjectsStatsStore.reset();
    };
  }, []);
  const [projectQuery, setProjectQuery] = useState('');
  const debouncedSearchQuery = useCallback(
    debounce(handleSearch, DEFAULT_DEBOUNCE_DURATION),
    []
  );

  if (loadingTeams) {
    return <LoadingIndicator />;
  }

  if (error) {
    return <LoadingError message={t('An error occurred while fetching your projects')} />;
  }

  const selectedTeams = new Set(getTeamParams(location.query.team));
  const filteredTeams = teams.filter(team => selectedTeams.has(team.id));
  const filteredTeamProjects = uniqBy(
    flatten((filteredTeams ?? teams).map(team => team.projects)),
    'id'
  );
  const projects = uniqBy(flatten(teams.map(teamObj => teamObj.projects)), 'id');
  const currentProjects = !selectedTeams.size ? projects : filteredTeamProjects;
  const filteredProjects = (currentProjects ?? projects).filter(project =>
    project.slug.includes(projectQuery)
  );
  const favorites = projects.filter(project => project.isBookmarked);

  const canCreateProjects = organization.access.includes('project:admin');
  const canJoinTeam = organization.access.includes('team:read');
  const hasTeamAdminAccess = organization.access.includes('team:admin');
  const hasProjectAccess = organization.access.includes('project:read');
  const hasProjectRedesign = organization.features.includes('projects-page-redesign');

  const showEmptyMessage = projects.length === 0 && favorites.length === 0;
  const showResources = projects.length === 1 && !projects[0].firstEvent;

  function handleSearch(searchQuery: string) {
    setProjectQuery(searchQuery);
  }

  function handleChangeFilter(sectionId: string, activeFilters: Set<string>) {
    const {...currentQuery} = location.query;

    let team = currentQuery.team;
    if (sectionId === 'teams') {
      team = activeFilters.size ? [...activeFilters] : '';
    }

    router.push({
      pathname: location.pathname,
      query: {
        ...currentQuery,
        team: team.length === 0 ? '' : team,
      },
    });
  }

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
            <ButtonContainer>
              {hasProjectRedesign && (
                <Button
                  size="small"
                  icon={<IconUser size="xs" />}
                  title={
                    canJoinTeam
                      ? undefined
                      : t('You do not have permission to join a team.')
                  }
                  disabled={!canJoinTeam}
                  to={`/settings/${organization.slug}/teams/`}
                  data-test-id="join-team"
                >
                  {t('Join a Team')}
                </Button>
              )}
              <Button
                size="small"
                priority={hasProjectRedesign ? 'primary' : 'default'}
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
            </ButtonContainer>
          </ProjectsHeader>
          {hasProjectRedesign && (
            <SearchAndSelectorWrapper>
              <StyledTeamFilter
                selectedTeams={selectedTeams}
                handleChangeFilter={handleChangeFilter}
                showIsMemberTeams
                showMyTeamsAndUnassigned={false}
              />
              <StyledSearchBar
                defaultQuery=""
                placeholder={t('Search for projects by name')}
                onChange={debouncedSearchQuery}
                query={projectQuery}
              />
            </SearchAndSelectorWrapper>
          )}
        </Fragment>
      )}

      {hasProjectRedesign ? (
        <LazyLoad once debounce={50} height={300} offset={300}>
          <ProjectCardsContainer>
            <ProjectCards>
              {filteredProjects.map(project => (
                <ProjectCard
                  data-test-id={project.slug}
                  key={project.slug}
                  project={project}
                  hasProjectAccess={hasProjectAccess}
                />
              ))}
            </ProjectCards>
          </ProjectCardsContainer>
        </LazyLoad>
      ) : (
        filteredTeams.map((team, index) => (
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
        ))
      )}
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

const ButtonContainer = styled('div')`
  display: inline-flex;
  gap: ${space(1)};
`;

const SearchAndSelectorWrapper = styled('div')`
  margin: ${space(2)} 30px 0 30px;
  display: flex;
  gap: 16px;
  justify-content: flex-end;
  align-items: flex-end;
`;

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
`;

const StyledTeamFilter = styled(TeamFilter)`
  margin: ${space(2)} 30px 0 0;
`;

const ProjectCardsContainer = styled('div')`
  padding: ${space(2)} 30px ${space(2)} 30px;
`;

const ProjectCards = styled('div')`
  display: grid;
  grid-template-columns: minmax(100px, 1fr);
  gap: ${space(3)};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: repeat(2, minmax(100px, 1fr));
  }

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    grid-template-columns: repeat(3, minmax(100px, 1fr));
  }
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

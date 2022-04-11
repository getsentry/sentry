import {Fragment, useCallback, useEffect, useState} from 'react';
import LazyLoad from 'react-lazyload';
import {RouteComponentProps} from 'react-router';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {withProfiler} from '@sentry/react';
import debounce from 'lodash/debounce';
import flatten from 'lodash/flatten';
import uniqBy from 'lodash/uniqBy';

import {Client} from 'sentry/api';
import Button from 'sentry/components/button';
import TeamSelector from 'sentry/components/forms/teamSelector';
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
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withTeamsForUser from 'sentry/utils/withTeamsForUser';

import ProjectCard from './projectCard';
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
  const [projectQuery, setProjectQuery] = useState('');
  const [currentTeam, setCurrentTeam] = useState('');
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

  const theme = useTheme();
  const isSuperuser = isActiveSuperuser();

  const filteredTeams = teams.filter(team => team.projects.length);
  filteredTeams.sort((team1, team2) => team1.slug.localeCompare(team2.slug));

  const projects = uniqBy(flatten(teams.map(teamObj => teamObj.projects)), 'id');
  const currentProjects = filteredTeams.find(team => team.id === currentTeam)?.projects;
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

  function handleChange(newValue) {
    const updatedTeam = newValue ? newValue.actor.id : '';
    setCurrentTeam(updatedTeam);
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
              <StyledSearchBar
                defaultQuery=""
                placeholder={t('Search for projects by name')}
                onChange={debouncedSearchQuery}
                query={projectQuery}
              />
              <StyledTeamSelector
                name="select-team"
                aria-label="select-team"
                inFieldLabel={t('Team: ')}
                placeholder={t('My Teams')}
                value={currentTeam}
                onChange={choice => handleChange(choice)}
                teamFilter={isSuperuser ? undefined : filterTeam => filterTeam.isMember}
                useId
                clearable
                styles={{
                  placeholder: (provided: any) => ({
                    ...provided,
                    paddingLeft: space(0.5),
                    ':before': {
                      ...provided[':before'],
                      color: theme.textColor,
                    },
                  }),
                  singleValue(provided: any) {
                    const custom = {
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: theme.fontSizeMedium,
                      ':before': {
                        ...provided[':before'],
                        color: theme.textColor,
                        marginRight: space(1.5),
                        marginLeft: space(0.5),
                      },
                    };
                    return {...provided, ...custom};
                  },
                  input: (provided: any, state: any) => ({
                    ...provided,
                    display: 'grid',
                    gridTemplateColumns: 'max-content 1fr',
                    alignItems: 'center',
                    marginRight: space(0.25),
                    gridGap: space(1.5),
                    ':before': {
                      backgroundColor: state.theme.backgroundSecondary,
                      height: 24,
                      width: 38,
                      borderRadius: 3,
                      content: '""',
                      display: 'block',
                    },
                  }),
                }}
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
  display: flex;
  gap: 16px;
  justify-content: flex-end;
  align-items: flex-end;
`;

const StyledSearchBar = styled(SearchBar)`
  margin-left: 30px;
  flex-grow: 1;
`;

const StyledTeamSelector = styled(TeamSelector)`
  margin: ${space(2)} 30px 0 0;
  width: 300px;
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

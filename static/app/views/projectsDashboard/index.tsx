import {Fragment, useEffect, useMemo, useState} from 'react';
import LazyLoad, {forceCheck} from 'react-lazyload';
import styled from '@emotion/styled';
import {withProfiler} from '@sentry/react';
import debounce from 'lodash/debounce';
import uniqBy from 'lodash/uniqBy';

import type {Client} from 'sentry/api';
import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {canCreateProject} from 'sentry/components/projects/canCreateProject';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {IconAdd, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import ProjectsStatsStore from 'sentry/stores/projectsStatsStore';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project, TeamWithProjects} from 'sentry/types/project';
import {
  onRenderCallback,
  Profiler,
  setGroupedEntityTag,
} from 'sentry/utils/performanceForSentry';
import {sortProjects} from 'sentry/utils/project/sortProjects';
import useOrganization from 'sentry/utils/useOrganization';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withTeamsForUser from 'sentry/utils/withTeamsForUser';
import TeamFilter from 'sentry/views/alerts/list/rules/teamFilter';

import ProjectCard from './projectCard';
import Resources from './resources';
import {getTeamParams} from './utils';

type Props = {
  api: Client;
  error: Error | null;
  loadingTeams: boolean;
  organization: Organization;
  teams: TeamWithProjects[];
} & RouteComponentProps<{}, {}>;

function ProjectCardList({projects}: {projects: Project[]}) {
  const organization = useOrganization();
  const hasProjectAccess = organization.access.includes('project:read');

  // By default react-lazyload will only check for intesecting components on scroll
  // This forceCheck call is necessary to recalculate when filtering projects
  useEffect(() => {
    forceCheck();
  }, [projects]);

  return (
    <ProjectCards>
      {sortProjects(projects).map(project => (
        <LazyLoad
          debounce={50}
          height={330}
          offset={400}
          unmountIfInvisible
          key={project.slug}
        >
          <ProjectCard
            data-test-id={project.slug}
            project={project}
            hasProjectAccess={hasProjectAccess}
          />
        </LazyLoad>
      ))}
    </ProjectCards>
  );
}

function Dashboard({teams, organization, loadingTeams, error, router, location}: Props) {
  useEffect(() => {
    return function cleanup() {
      ProjectsStatsStore.reset();
    };
  }, []);
  const [projectQuery, setProjectQuery] = useState('');
  const debouncedSearchQuery = useMemo(
    () => debounce(handleSearch, DEFAULT_DEBOUNCE_DURATION),
    []
  );

  const canUserCreateProject = canCreateProject(organization);
  if (loadingTeams) {
    return <LoadingIndicator />;
  }

  if (error) {
    return <LoadingError message={t('An error occurred while fetching your projects')} />;
  }
  const canJoinTeam = organization.access.includes('team:read');

  const selectedTeams = getTeamParams(location ? location.query.team : '');
  const filteredTeams = teams.filter(team => selectedTeams.includes(team.id));

  const filteredTeamProjects = uniqBy(
    (filteredTeams ?? teams).flatMap(team => team.projects),
    'id'
  );
  const projects = uniqBy(
    teams.flatMap(teamObj => teamObj.projects),
    'id'
  );
  setGroupedEntityTag('projects.total', 1000, projects.length);

  const currentProjects = selectedTeams.length === 0 ? projects : filteredTeamProjects;
  const filteredProjects = (currentProjects ?? projects).filter(project =>
    project.slug.includes(projectQuery)
  );

  const showResources = projects.length === 1 && !projects[0]!.firstEvent;

  function handleSearch(searchQuery: string) {
    setProjectQuery(searchQuery);
  }

  function handleChangeFilter(activeFilters: string[]) {
    const {...currentQuery} = location.query;

    router.push({
      pathname: location.pathname,
      query: {
        ...currentQuery,
        team: activeFilters.length > 0 ? activeFilters : '',
      },
    });
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Projects Dashboard')} orgSlug={organization.slug} />
      <Layout.Header>
        <Layout.HeaderContent>
          <Layout.Title>
            {t('Projects')}
            <PageHeadingQuestionTooltip
              docsUrl="https://docs.sentry.io/product/projects/"
              title={t(
                "A high-level overview of errors, transactions, and deployments filtered by teams you're part of."
              )}
            />
          </Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <ButtonBar gap={1}>
            <LinkButton
              size="sm"
              icon={<IconUser />}
              title={
                canJoinTeam ? undefined : t('You do not have permission to join a team.')
              }
              disabled={!canJoinTeam}
              to={`/settings/${organization.slug}/teams/`}
              data-test-id="join-team"
            >
              {t('Join a Team')}
            </LinkButton>
            <LinkButton
              size="sm"
              priority="primary"
              disabled={!canUserCreateProject}
              title={
                !canUserCreateProject
                  ? t('You do not have permission to create projects')
                  : undefined
              }
              to={`/organizations/${organization.slug}/projects/new/`}
              icon={<IconAdd isCircled />}
              data-test-id="create-project"
            >
              {t('Create Project')}
            </LinkButton>
          </ButtonBar>
        </Layout.HeaderActions>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>
          <SearchAndSelectorWrapper>
            <TeamFilter
              selectedTeams={selectedTeams}
              handleChangeFilter={handleChangeFilter}
              showIsMemberTeams
              showSuggestedOptions={false}
              showMyTeamsDescription
            />
            <StyledSearchBar
              defaultQuery=""
              placeholder={t('Search for projects by name')}
              onChange={debouncedSearchQuery}
              query={projectQuery}
            />
          </SearchAndSelectorWrapper>

          <Profiler id="ProjectCardList" onRender={onRenderCallback}>
            <ProjectCardList projects={filteredProjects} />
          </Profiler>
        </Layout.Main>
      </Layout.Body>
      {showResources && <Resources organization={organization} />}
    </Fragment>
  );
}

function OrganizationDashboard(props: Props) {
  return (
    <Layout.Page>
      <NoProjectMessage organization={props.organization}>
        <Dashboard {...props} />
      </NoProjectMessage>
    </Layout.Page>
  );
}

const SearchAndSelectorWrapper = styled('div')`
  display: flex;
  gap: ${space(2)};
  justify-content: flex-end;
  align-items: flex-end;
  margin-bottom: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: block;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    display: flex;
  }
`;

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    margin-top: ${space(1)};
  }
`;

const ProjectCards = styled('div')`
  display: grid;
  gap: ${space(3)};
  grid-template-columns: repeat(auto-fill, minmax(1fr, 400px));

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: repeat(auto-fill, minmax(470px, 1fr));
  }

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: repeat(auto-fill, minmax(450px, 1fr));
  }
`;

export {Dashboard};
export default withApi(
  withOrganization(withTeamsForUser(withProfiler(OrganizationDashboard)))
);

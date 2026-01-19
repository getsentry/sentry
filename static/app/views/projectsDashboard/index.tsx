import {Fragment, useEffect, useMemo, useState} from 'react';
import LazyLoad, {forceCheck} from 'react-lazyload';
import styled from '@emotion/styled';
import {withProfiler} from '@sentry/react';
import debounce from 'lodash/debounce';
import uniqBy from 'lodash/uniqBy';

import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Link} from 'sentry/components/core/link';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {IconAdd, IconUser} from 'sentry/icons';
import {t, tctCode} from 'sentry/locale';
import ProjectsStatsStore from 'sentry/stores/projectsStatsStore';
import {space} from 'sentry/styles/space';
import type {Team} from 'sentry/types/organization';
import type {Project, TeamWithProjects} from 'sentry/types/project';
import {
  PageAlert,
  PageAlertProvider,
  usePageAlert,
} from 'sentry/utils/performance/contexts/pageAlert';
import {
  onRenderCallback,
  Profiler,
  setGroupedEntityTag,
} from 'sentry/utils/performanceForSentry';
import {sortProjects} from 'sentry/utils/project/sortProjects';
import {useCanCreateProject} from 'sentry/utils/useCanCreateProject';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useTeamsById} from 'sentry/utils/useTeamsById';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import TeamFilter from 'sentry/views/alerts/list/rules/teamFilter';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

import ProjectCard from './projectCard';
import Resources from './resources';
import {getTeamParams} from './utils';

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

function addProjectsToTeams(teams: Team[], projects: Project[]): TeamWithProjects[] {
  return teams.map(team => ({
    ...team,
    projects: projects.filter(project => project.teams.some(tm => tm.id === team.id)),
  }));
}

function getFilteredProjectsBasedOnTeams({
  allTeams,
  userTeams,
  selectedTeams,
  isAllTeams,
  showNonMemberProjects,
  projects,
  projectQuery,
}: {
  allTeams: Team[];
  isAllTeams: boolean;
  projectQuery: string;
  projects: Project[];
  selectedTeams: string[];
  showNonMemberProjects: boolean;
  userTeams: Team[];
}): Project[] {
  const myTeamIds = new Set(userTeams.map(team => team.id));
  const includeMyTeams = isAllTeams || selectedTeams.includes('myteams');
  const selectedOtherTeamIds = new Set(
    selectedTeams.filter(teamId => teamId !== 'myteams')
  );
  const myTeams = includeMyTeams ? allTeams.filter(team => myTeamIds.has(team.id)) : [];
  const otherTeams = isAllTeams
    ? allTeams
    : allTeams.filter(team => selectedOtherTeamIds.has(String(team.id)));

  const visibleTeams = [...myTeams, ...otherTeams].filter(team => {
    if (showNonMemberProjects) {
      return true;
    }
    return team.isMember;
  });
  const teamsWithProjects = addProjectsToTeams(visibleTeams, projects);
  const currentProjects = uniqBy(
    teamsWithProjects.flatMap(team => team.projects),
    'id'
  );
  const currentProjectIds = new Set(currentProjects.map(p => p.id));
  const unassignedProjects =
    isAllTeams && showNonMemberProjects
      ? projects.filter(project => !currentProjectIds.has(project.id))
      : [];
  return [...currentProjects, ...unassignedProjects].filter(project =>
    project.slug.includes(projectQuery)
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();

  useEffect(() => {
    return function cleanup() {
      ProjectsStatsStore.reset();
    };
  }, []);
  const {teams: userTeams, isLoading: loadingTeams, isError} = useUserTeams();
  const isAllTeams = location.query.team === '';
  const selectedTeams = getTeamParams(location.query.team ?? 'myteams');
  const {setPageInfo, pageAlert} = usePageAlert();

  const msg = useMemo(
    () =>
      tctCode(
        'Project Details pages will be removed soon. You can edit project settings and create new projects in [settingsLink:Settings].',
        {
          settingsLink: <Link to={`/settings/${organization.slug}/projects/`} />,
        }
      ),
    [organization.slug]
  );

  useEffect(() => {
    if (pageAlert?.message !== msg) {
      setPageInfo(msg);
    }
  }, [setPageInfo, pageAlert, msg]);

  const {teams: allTeams} = useTeamsById({
    ids: selectedTeams.filter(team => team !== 'myteams'),
  });
  const user = useUser();
  const [projectQuery, setProjectQuery] = useState('');
  const debouncedSearchQuery = useMemo(
    () => debounce(handleSearch, DEFAULT_DEBOUNCE_DURATION),
    []
  );
  const {projects, fetching, fetchError} = useProjects();
  const canUserCreateProject = useCanCreateProject();

  const showNonMemberProjects = useMemo(() => {
    const isOrgAdminOrManager =
      organization.orgRole === 'owner' || organization.orgRole === 'manager';
    const isOpenMembership = organization.features.includes('open-membership');

    return user.isSuperuser || isOrgAdminOrManager || isOpenMembership;
  }, [user, organization.orgRole, organization.features]);

  if (loadingTeams || fetching) {
    return <LoadingIndicator />;
  }

  if (isError || fetchError) {
    return <LoadingError message={t('An error occurred while fetching your projects')} />;
  }

  const filteredProjects = getFilteredProjectsBasedOnTeams({
    allTeams,
    userTeams,
    selectedTeams,
    isAllTeams,
    showNonMemberProjects,
    projects,
    projectQuery,
  });

  setGroupedEntityTag('projects.total', 1000, projects.length);

  const showResources = projects.length === 1 && !projects[0]!.firstEvent;

  const canJoinTeam = organization.access.includes('team:read');

  function handleSearch(searchQuery: string) {
    setProjectQuery(searchQuery);
  }

  function handleChangeFilter(activeFilters: string[]) {
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        team: activeFilters.length > 0 ? activeFilters : '',
      },
    });
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Projects Dashboard')} orgSlug={organization.slug} />
      <Layout.Header unified>
        <Layout.HeaderContent unified>
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
          <ButtonBar>
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
                canUserCreateProject
                  ? undefined
                  : t('You do not have permission to create projects')
              }
              to={makeProjectsPathname({
                path: '/new/',
                organization,
              })}
              icon={<IconAdd />}
              data-test-id="create-project"
            >
              {t('Create Project')}
            </LinkButton>
          </ButtonBar>
        </Layout.HeaderActions>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main width="full">
          <PageAlert />
          <SearchAndSelectorWrapper>
            <TeamFilter
              selectedTeams={selectedTeams}
              handleChangeFilter={handleChangeFilter}
              hideUnassigned
              hideOtherTeams={!showNonMemberProjects}
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

function OrganizationDashboard() {
  const organization = useOrganization();
  return (
    <Layout.Page>
      <NoProjectMessage organization={organization}>
        <PageAlertProvider>
          <Dashboard />
        </PageAlertProvider>
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

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: block;
  }

  @media (min-width: ${p => p.theme.breakpoints.xl}) {
    display: flex;
  }
`;

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    margin-top: ${space(1)};
  }
`;

const ProjectCards = styled('div')`
  display: grid;
  gap: ${space(3)};
  grid-template-columns: repeat(auto-fill, minmax(1fr, 400px));

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: repeat(auto-fill, minmax(470px, 1fr));
  }

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: repeat(auto-fill, minmax(450px, 1fr));
  }
`;

export default withProfiler(OrganizationDashboard);

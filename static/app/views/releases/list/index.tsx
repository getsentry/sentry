import {Fragment} from 'react';
import {forceCheck} from 'react-lazyload';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import {Alert} from 'sentry/components/alert';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import DatePageFilter from 'sentry/components/datePageFilter';
import EmptyMessage from 'sentry/components/emptyMessage';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {getRelativeSummary} from 'sentry/components/organizations/timeRangeSelector/utils';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {ItemType} from 'sentry/components/smartSearchBar/types';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {releaseHealth} from 'sentry/data/platformCategories';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import {
  Organization,
  PageFilters,
  Project,
  Release,
  ReleaseStatus,
  Tag,
} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {SEMVER_TAGS} from 'sentry/utils/discover/fields';
import Projects from 'sentry/utils/projects';
import routeTitleGen from 'sentry/utils/routeTitle';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import withProjects from 'sentry/utils/withProjects';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';

import Header from '../components/header';
import ReleaseArchivedNotice from '../detail/overview/releaseArchivedNotice';
import {isMobileRelease} from '../utils';
import {THRESHOLDS_VIEW} from '../utils/constants';

import Header from './header';
import ReleaseCard from './releaseCard';
import ReleasesAdoptionChart from './releasesAdoptionChart';
import ReleasesDisplayOptions, {ReleasesDisplayOption} from './releasesDisplayOptions';
import ReleasesPromo from './releasesPromo';
import ReleasesRequest from './releasesRequest';
import ReleasesSortOptions, {ReleasesSortOption} from './releasesSortOptions';
import ReleasesStatusOptions, {ReleasesStatusOption} from './releasesStatusOptions';
import ThresholdsList from './thresholdsList';

type RouteParams = {
  orgId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  projects: Project[];
  selection: PageFilters;
};

type State = {
  releases: Release[];
} & DeprecatedAsyncView['state'];

class ReleasesList extends DeprecatedAsyncView<Props, State> {
  shouldReload = true;
  shouldRenderBadRequests = true;
  hasV2ReleaseUIEnabled = this.props.organization.features.includes('release-ui-v2');

  getTitle() {
    return routeTitleGen(t('Releases'), this.props.organization.slug, false);
  }

  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    const {organization, location} = this.props;
    const {statsPeriod} = location.query;
    const activeSort = this.getSort();
    const activeStatus = this.getStatus();

    const query = {
      ...pick(location.query, ['project', 'environment', 'cursor', 'query', 'sort']),
      summaryStatsPeriod: statsPeriod,
      per_page: 20,
      flatten: activeSort === ReleasesSortOption.DATE ? 0 : 1,
      adoptionStages: 1,
      status:
        activeStatus === ReleasesStatusOption.ARCHIVED
          ? ReleaseStatus.ARCHIVED
          : ReleaseStatus.ACTIVE,
    };

    const endpoints: ReturnType<DeprecatedAsyncView['getEndpoints']> = [
      [
        'releases', // stateKey
        `/organizations/${organization.slug}/releases/`, // endpoint
        {query}, // params
        {disableEntireQuery: true}, // options
      ],
    ];

    return endpoints;
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    super.componentDidUpdate(prevProps, prevState);

    if (prevState.releases !== this.state.releases) {
      /**
       * Manually trigger checking for elements in viewport.
       * Helpful when LazyLoad components enter the viewport without resize or scroll events,
       * https://github.com/twobin/react-lazyload#forcecheck
       *
       * HealthStatsCharts are being rendered only when they are scrolled into viewport.
       * This is how we re-check them without scrolling once releases change as this view
       * uses shouldReload=true and there is no reloading happening.
       */
      forceCheck();
    }
  }

  getQuery() {
    const {query} = this.props.location.query;

    return typeof query === 'string' ? query : undefined;
  }

  getSort(): ReleasesSortOption {
    const {environments} = this.props.selection;
    const {sort} = this.props.location.query;

    // Require 1 environment for date adopted
    if (sort === ReleasesSortOption.ADOPTION && environments.length !== 1) {
      return ReleasesSortOption.DATE;
    }

    const sortExists = Object.values(ReleasesSortOption).includes(sort);
    if (sortExists) {
      return sort;
    }

    return ReleasesSortOption.DATE;
  }

  getDisplay(): ReleasesDisplayOption {
    const {display} = this.props.location.query;

    switch (display) {
      case ReleasesDisplayOption.USERS:
        return ReleasesDisplayOption.USERS;
      default:
        return ReleasesDisplayOption.SESSIONS;
    }
  }

  getStatus(): ReleasesStatusOption {
    const {status} = this.props.location.query;

    switch (status) {
      case ReleasesStatusOption.ARCHIVED:
        return ReleasesStatusOption.ARCHIVED;
      default:
        return ReleasesStatusOption.ACTIVE;
    }
  }

  getSelectedProject(): Project | undefined {
    const {selection, projects} = this.props;

    const selectedProjectId =
      selection.projects && selection.projects.length === 1 && selection.projects[0];
    return projects?.find(p => p.id === `${selectedProjectId}`);
  }

  getAllSelectedProjects(): Project[] {
    const {selection, projects} = this.props;
    return projects.filter(project =>
      selection.projects.some(id => id === parseInt(project.id, 10) || id === -1)
    );
  }

  getAllEnvironments(): string[] {
    const {selection, projects} = this.props;
    const selectedProjects = selection.projects;
    const {user} = ConfigStore.getState();
    const allEnvSet = new Set(projects.flatMap(project => project.environments));
    // NOTE: mostly taken from environmentSelector.tsx
    const unSortedEnvs = new Set(
      projects.flatMap(project => {
        const projectId = parseInt(project.id, 10);
        /**
         * Include environments from:
         * all projects if the user is a superuser
         * the requested projects
         * all member projects if 'my projects' (empty list) is selected.
         * all projects if -1 is the only selected project.
         */
        if (
          (selectedProjects.length === 1 &&
            selectedProjects[0] === ALL_ACCESS_PROJECTS &&
            project.hasAccess) ||
          (selectedProjects.length === 0 && (project.isMember || user.isSuperuser)) ||
          selectedProjects.includes(projectId)
        ) {
          return project.environments;
        }

        return [];
      })
    );
    const envDiff = new Set([...allEnvSet].filter(x => !unSortedEnvs.has(x)));

    return Array.from(unSortedEnvs)
      .sort()
      .concat([...envDiff].sort());
  }

  get projectHasSessions() {
    return this.getSelectedProject()?.hasSessions ?? null;
  }

  handleSearch = (query: string) => {
    const {location, router} = this.props;

    router.push({
      ...location,
      query: {...location.query, cursor: undefined, query},
    });
  };

  handleSortBy = (sort: string) => {
    const {location, router} = this.props;

    router.push({
      ...location,
      query: {...location.query, cursor: undefined, sort},
    });
  };

  handleDisplay = (display: string) => {
    const {location, router} = this.props;

    let sort = location.query.sort;
    if (
      sort === ReleasesSortOption.USERS_24_HOURS &&
      display === ReleasesDisplayOption.SESSIONS
    ) {
      sort = ReleasesSortOption.SESSIONS_24_HOURS;
    } else if (
      sort === ReleasesSortOption.SESSIONS_24_HOURS &&
      display === ReleasesDisplayOption.USERS
    ) {
      sort = ReleasesSortOption.USERS_24_HOURS;
    } else if (
      sort === ReleasesSortOption.CRASH_FREE_USERS &&
      display === ReleasesDisplayOption.SESSIONS
    ) {
      sort = ReleasesSortOption.CRASH_FREE_SESSIONS;
    } else if (
      sort === ReleasesSortOption.CRASH_FREE_SESSIONS &&
      display === ReleasesDisplayOption.USERS
    ) {
      sort = ReleasesSortOption.CRASH_FREE_USERS;
    }

    router.push({
      ...location,
      query: {...location.query, cursor: undefined, display, sort},
    });
  };

  handleStatus = (status: string) => {
    const {location, router} = this.props;

    router.push({
      ...location,
      query: {...location.query, cursor: undefined, status},
    });
  };

  trackAddReleaseHealth = () => {
    const {organization, selection} = this.props;

    if (organization.id && selection.projects[0]) {
      trackAnalytics('releases_list.click_add_release_health', {
        organization,
        project_id: selection.projects[0],
      });
    }
  };

  tagValueLoader = (key: string, search: string) => {
    const {location, organization} = this.props;
    const {project: projectId} = location.query;

    return fetchTagValues({
      api: this.api,
      orgSlug: organization.slug,
      tagKey: key,
      search,
      projectIds: projectId ? [projectId] : undefined,
      endpointParams: location.query,
    });
  };

  getTagValues = async (tag: Tag, currentQuery: string): Promise<string[]> => {
    const values = await this.tagValueLoader(tag.key, currentQuery);
    return values.map(({value}) => value);
  };

  shouldShowLoadingIndicator() {
    const {loading, releases, reloading} = this.state;

    return (loading && !reloading) || (loading && !releases?.length);
  }

  renderLoading() {
    return this.renderBody();
  }

  renderError() {
    return this.renderBody();
  }

  get shouldShowQuickstart() {
    const {releases} = this.state;

    const selectedProject = this.getSelectedProject();
    const hasReleasesSetup = selectedProject?.features.includes('releases');

    return !releases?.length && !hasReleasesSetup && selectedProject;
  }

  renderEmptyMessage() {
    const {location} = this.props;
    const {statsPeriod, start, end} = location.query;
    const searchQuery = this.getQuery();
    const activeSort = this.getSort();
    const activeStatus = this.getStatus();

    const selectedPeriod =
      !!start && !!end
        ? t('time range')
        : getRelativeSummary(statsPeriod || DEFAULT_STATS_PERIOD).toLowerCase();

    if (searchQuery && searchQuery.length) {
      return (
        <Panel>
          <EmptyMessage icon={<IconSearch size="xl" />} size="large">{`${t(
            'There are no releases that match'
          )}: '${searchQuery}'.`}</EmptyMessage>
        </Panel>
      );
    }

    if (activeSort === ReleasesSortOption.USERS_24_HOURS) {
      return (
        <Panel>
          <EmptyMessage icon={<IconSearch size="xl" />} size="large">
            {t(
              'There are no releases with active user data (users in the last 24 hours).'
            )}
          </EmptyMessage>
        </Panel>
      );
    }

    if (activeSort === ReleasesSortOption.SESSIONS_24_HOURS) {
      return (
        <Panel>
          <EmptyMessage icon={<IconSearch size="xl" />} size="large">
            {t(
              'There are no releases with active session data (sessions in the last 24 hours).'
            )}
          </EmptyMessage>
        </Panel>
      );
    }

    if (
      activeSort === ReleasesSortOption.BUILD ||
      activeSort === ReleasesSortOption.SEMVER
    ) {
      return (
        <Panel>
          <EmptyMessage icon={<IconSearch size="xl" />} size="large">
            {t('There are no releases with semantic versioning.')}
          </EmptyMessage>
        </Panel>
      );
    }

    if (activeSort !== ReleasesSortOption.DATE) {
      return (
        <Panel>
          <EmptyMessage icon={<IconSearch size="xl" />} size="large">
            {`${t('There are no releases with data in the')} ${selectedPeriod}.`}
          </EmptyMessage>
        </Panel>
      );
    }

    if (activeStatus === ReleasesStatusOption.ARCHIVED) {
      return (
        <Panel>
          <EmptyMessage icon={<IconSearch size="xl" />} size="large">
            {t('There are no archived releases.')}
          </EmptyMessage>
        </Panel>
      );
    }

    return (
      <Panel>
        <EmptyMessage icon={<IconSearch size="xl" />} size="large">
          {`${t('There are no releases with data in the')} ${selectedPeriod}.`}
        </EmptyMessage>
      </Panel>
    );
  }

  renderHealthCta() {
    const {organization} = this.props;
    const {releases} = this.state;

    const selectedProject = this.getSelectedProject();

    if (!selectedProject || this.projectHasSessions !== false || !releases?.length) {
      return null;
    }

    return (
      <Projects orgId={organization.slug} slugs={[selectedProject.slug]}>
        {({projects, initiallyLoaded, fetchError}) => {
          const project = projects && projects.length === 1 && projects[0];
          const projectCanHaveReleases =
            project && project.platform && releaseHealth.includes(project.platform);

          if (!initiallyLoaded || fetchError || !projectCanHaveReleases) {
            return null;
          }

          return (
            <Alert type="info" showIcon>
              <AlertText>
                <div>
                  {t(
                    'To track user adoption, crash rates, session data and more, add Release Health to your current setup.'
                  )}
                </div>
                <ExternalLink
                  href="https://docs.sentry.io/product/releases/setup/#release-health"
                  onClick={this.trackAddReleaseHealth}
                >
                  {t('Add Release Health')}
                </ExternalLink>
              </AlertText>
            </Alert>
          );
        }}
      </Projects>
    );
  }

  renderInnerBody(
    activeDisplay: ReleasesDisplayOption,
    showReleaseAdoptionStages: boolean
  ) {
    const {location, selection, organization, router} = this.props;
    const {releases, reloading, releasesPageLinks} = this.state;

    const selectedProject = this.getSelectedProject();
    const hasReleasesSetup = selectedProject?.features.includes('releases');

    if (this.shouldShowLoadingIndicator()) {
      return <LoadingIndicator />;
    }

    if (!releases?.length && hasReleasesSetup) {
      return this.renderEmptyMessage();
    }

    if (this.shouldShowQuickstart) {
      return <ReleasesPromo organization={organization} project={selectedProject!} />;
    }

    if (this.hasV2ReleaseUIEnabled && router.location.query.view === THRESHOLDS_VIEW) {
      return (
        <ThresholdsList
          organization={organization}
          selectedEnvs={selection.environments}
          selectedProjectIds={selection.projects}
        />
      );
    }

    return (
      <ReleasesRequest
        releases={releases.map(({version}) => version)}
        organization={organization}
        selection={selection}
        location={location}
        display={[this.getDisplay()]}
        releasesReloading={reloading}
        healthStatsPeriod={location.query.healthStatsPeriod}
      >
        {({isHealthLoading, getHealthData}) => {
          const singleProjectSelected =
            selection.projects?.length === 1 &&
            selection.projects[0] !== ALL_ACCESS_PROJECTS;
          const isMobileProject =
            selectedProject?.platform && isMobileRelease(selectedProject.platform);

          return (
            <Fragment>
              {singleProjectSelected && this.projectHasSessions && isMobileProject && (
                <ReleasesAdoptionChart
                  organization={organization}
                  selection={selection}
                  location={location}
                  router={router}
                  activeDisplay={activeDisplay}
                />
              )}

              {releases.map((release, index) => (
                <ReleaseCard
                  key={`${release.version}-${release.projects[0].slug}`}
                  activeDisplay={activeDisplay}
                  release={release}
                  organization={organization}
                  location={location}
                  selection={selection}
                  reloading={reloading}
                  showHealthPlaceholders={isHealthLoading}
                  isTopRelease={index === 0}
                  getHealthData={getHealthData}
                  showReleaseAdoptionStages={showReleaseAdoptionStages}
                />
              ))}
              <Pagination pageLinks={releasesPageLinks} />
            </Fragment>
          );
        }}
      </ReleasesRequest>
    );
  }

  renderBody() {
    const {organization, selection, router} = this.props;
    const {releases, reloading, error} = this.state;

    const activeSort = this.getSort();
    const activeStatus = this.getStatus();
    const activeDisplay = this.getDisplay();

    const hasAnyMobileProject = selection.projects
      .map(id => `${id}`)
      .map(ProjectsStore.getById)
      .some(project => project?.platform && isMobileRelease(project.platform));
    const showReleaseAdoptionStages =
      hasAnyMobileProject && selection.environments.length === 1;
    const hasReleasesSetup = releases && releases.length > 0;
    const viewingThresholds =
      this.hasV2ReleaseUIEnabled && router.location.query.view === THRESHOLDS_VIEW;

    return (
      <PageFiltersContainer showAbsolute={false}>
        <NoProjectMessage organization={organization}>
          <Header router={router} hasV2ReleaseUIEnabled={this.hasV2ReleaseUIEnabled} />

          <Layout.Body>
            <Layout.Main fullWidth>
              {this.renderHealthCta()}

              <ReleasesPageFilterBar condensed>
                <GuideAnchor target="release_projects">
                  <ProjectPageFilter />
                </GuideAnchor>
                <EnvironmentPageFilter />
                {!viewingThresholds && (
                  <DatePageFilter
                    alignDropdown="left"
                    disallowArbitraryRelativeRanges
                    hint={t(
                      'Changing this date range will recalculate the release metrics.'
                    )}
                  />
                )}
              </ReleasesPageFilterBar>

              {/* TODO: Different search bar for thresholds - should be able to search for projects. don't need status/date/display filters */}
              {this.shouldShowQuickstart || viewingThresholds ? null : (
                <SortAndFilterWrapper>
                  <GuideAnchor
                    target="releases_search"
                    position="bottom"
                    disabled={!hasReleasesSetup}
                  >
                    <StyledSmartSearchBar
                      searchSource="releases"
                      query={this.getQuery()}
                      placeholder={t('Search by version, build, package, or stage')}
                      hasRecentSearches={false}
                      supportedTags={{
                        ...SEMVER_TAGS,
                        release: {
                          key: 'release',
                          name: 'release',
                        },
                      }}
                      maxMenuHeight={500}
                      supportedTagType={ItemType.PROPERTY}
                      onSearch={this.handleSearch}
                      onGetTagValues={this.getTagValues}
                    />
                  </GuideAnchor>
                  <ReleasesStatusOptions
                    selected={activeStatus}
                    onSelect={this.handleStatus}
                  />
                  <ReleasesSortOptions
                    selected={activeSort}
                    selectedDisplay={activeDisplay}
                    onSelect={this.handleSortBy}
                    environments={selection.environments}
                  />
                  <ReleasesDisplayOptions
                    selected={activeDisplay}
                    onSelect={this.handleDisplay}
                  />
                </SortAndFilterWrapper>
              )}

              {!reloading &&
                activeStatus === ReleasesStatusOption.ARCHIVED &&
                !!releases?.length && <ReleaseArchivedNotice multi />}

              {error
                ? super.renderError()
                : this.renderInnerBody(activeDisplay, showReleaseAdoptionStages)}
            </Layout.Main>
          </Layout.Body>
        </NoProjectMessage>
      </PageFiltersContainer>
    );
  }
}

const AlertText = styled('div')`
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  gap: ${space(2)};

  > *:nth-child(1) {
    flex: 1;
  }
  flex-direction: column;
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    flex-direction: row;
  }
`;

const ReleasesPageFilterBar = styled(PageFilterBar)`
  margin-bottom: ${space(2)};
`;

const SortAndFilterWrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr repeat(3, max-content);
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: repeat(3, 1fr);
    & > div {
      width: auto;
    }
  }
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const StyledSmartSearchBar = styled(SmartSearchBar)`
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    grid-column: 1 / -1;
  }
`;

export default withProjects(withOrganization(withPageFilters(ReleasesList)));

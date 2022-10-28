import {Fragment} from 'react';
import {forceCheck} from 'react-lazyload';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import Alert from 'sentry/components/alert';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import DatePageFilter from 'sentry/components/datePageFilter';
import EmptyMessage from 'sentry/components/emptyMessage';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {getRelativeSummary} from 'sentry/components/organizations/timeRangeSelector/utils';
import PageHeading from 'sentry/components/pageHeading';
import Pagination from 'sentry/components/pagination';
import {Panel} from 'sentry/components/panels';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {ItemType} from 'sentry/components/smartSearchBar/types';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {releaseHealth} from 'sentry/data/platformCategories';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {PageContent, PageHeader} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {
  Organization,
  PageFilters,
  Project,
  Release,
  ReleaseStatus,
  Tag,
} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import {SEMVER_TAGS} from 'sentry/utils/discover/fields';
import Projects from 'sentry/utils/projects';
import routeTitleGen from 'sentry/utils/routeTitle';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import withProjects from 'sentry/utils/withProjects';
import AsyncView from 'sentry/views/asyncView';

import ReleaseArchivedNotice from '../detail/overview/releaseArchivedNotice';
import {isMobileRelease} from '../utils';

import ReleaseCard from './releaseCard';
import ReleasesAdoptionChart from './releasesAdoptionChart';
import ReleasesDisplayOptions, {ReleasesDisplayOption} from './releasesDisplayOptions';
import ReleasesPromo from './releasesPromo';
import ReleasesRequest from './releasesRequest';
import ReleasesSortOptions, {ReleasesSortOption} from './releasesSortOptions';
import ReleasesStatusOptions, {ReleasesStatusOption} from './releasesStatusOptions';

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
} & AsyncView['state'];

class ReleasesList extends AsyncView<Props, State> {
  shouldReload = true;
  shouldRenderBadRequests = true;

  getTitle() {
    return routeTitleGen(t('Releases'), this.props.organization.slug, false);
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
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
          ? ReleaseStatus.Archived
          : ReleaseStatus.Active,
    };

    const endpoints: ReturnType<AsyncView['getEndpoints']> = [
      [
        'releases',
        `/organizations/${organization.slug}/releases/`,
        {query},
        {disableEntireQuery: true},
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
      trackAnalyticsEvent({
        eventKey: `releases_list.click_add_release_health`,
        eventName: `Releases List: Click Add Release Health`,
        organization_id: parseInt(organization.id, 10),
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
    const {organization, selection} = this.props;
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

    return (
      <PageFiltersContainer showAbsolute={false}>
        <PageContent>
          <NoProjectMessage organization={organization}>
            <PageHeader>
              <PageHeading>{t('Releases')}</PageHeading>
            </PageHeader>

            {this.renderHealthCta()}

            <ReleasesPageFilterBar condensed>
              <GuideAnchor target="release_projects">
                <ProjectPageFilter />
              </GuideAnchor>
              <EnvironmentPageFilter />
              <DatePageFilter
                alignDropdown="left"
                disallowArbitraryRelativeRanges
                hint={t('Changing this date range will recalculate the release metrics.')}
              />
            </ReleasesPageFilterBar>

            {this.shouldShowQuickstart ? null : (
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
              ? super.renderError(new Error('Unable to load all required endpoints'))
              : this.renderInnerBody(activeDisplay, showReleaseAdoptionStages)}
          </NoProjectMessage>
        </PageContent>
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

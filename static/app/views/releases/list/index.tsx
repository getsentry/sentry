import {Fragment} from 'react';
import {forceCheck} from 'react-lazyload';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import type {Client} from 'sentry/api';
import {Alert} from 'sentry/components/alert';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import EmptyMessage from 'sentry/components/emptyMessage';
import FloatingFeedbackWidget from 'sentry/components/feedback/widget/floatingFeedbackWidget';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {getRelativeSummary} from 'sentry/components/timeRangeSelector/utils';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {ReleasesSortOption} from 'sentry/constants/releases';
import {releaseHealth} from 'sentry/data/platformCategories';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {Tag} from 'sentry/types/group';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {AvatarProject, Project} from 'sentry/types/project';
import type {Release} from 'sentry/types/release';
import {ReleaseStatus} from 'sentry/types/release';
import {trackAnalytics} from 'sentry/utils/analytics';
import {SEMVER_TAGS} from 'sentry/utils/discover/fields';
import Projects from 'sentry/utils/projects';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import withProjects from 'sentry/utils/withProjects';

import Header from '../components/header';
import ReleaseArchivedNotice from '../detail/overview/releaseArchivedNotice';
import {isMobileRelease} from '../utils';

import ReleaseCard from './releaseCard';
import ReleasesAdoptionChart from './releasesAdoptionChart';
import ReleasesDisplayOptions, {ReleasesDisplayOption} from './releasesDisplayOptions';
import ReleasesPromo from './releasesPromo';
import ReleasesRequest from './releasesRequest';
import ReleasesSortOptions from './releasesSortOptions';
import ReleasesStatusOptions, {ReleasesStatusOption} from './releasesStatusOptions';

type RouteParams = {
  orgId: string;
};

type Props = RouteComponentProps<RouteParams> & {
  api: Client;
  organization: Organization;
  projects: Project[];
  selection: PageFilters;
};

type State = {
  releases: Release[];
} & DeprecatedAsyncComponent['state'];

class ReleasesList extends DeprecatedAsyncComponent<Props, State> {
  shouldReload = true;
  shouldRenderBadRequests = true;

  filterKeys = [
    ...Object.values(SEMVER_TAGS),
    {
      key: 'release',
      name: 'release',
    },
  ].reduce((acc, tag) => {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    acc[tag.key] = tag;
    return acc;
  }, {});

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
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

    const endpoints: ReturnType<DeprecatedAsyncComponent['getEndpoints']> = [
      [
        'releases', // stateKey
        `/organizations/${organization.slug}/releases/`, // endpoint
        {query}, // params
        {disableEntireQuery: true}, // options - prevent cursor from being passed into query
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

    // Return the first project when 'All Projects' is displayed.
    // This ensures the onboarding panel is shown correctly, for example.
    if (selection.projects.length === 0) {
      return projects[0];
    }

    const selectedProjectId =
      selection.projects && selection.projects.length === 1 && selection.projects[0];
    return projects?.find(p => p.id === `${selectedProjectId}`);
  }

  getSelectedProjectSlugs(): string[] {
    const {selection, projects} = this.props;
    const projIdSet = new Set(selection.projects);

    return projects.reduce((result: string[], proj) => {
      if (projIdSet.has(Number(proj.id))) {
        result.push(proj.slug);
      }
      return result;
    }, []);
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
      endpointParams: normalizeDateTimeParams(location.query),
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

    if (searchQuery?.length) {
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
          const project: AvatarProject | undefined =
            projects?.length === 1 ? projects.at(0) : undefined;
          const projectCanHaveReleases =
            project?.platform && releaseHealth.includes(project.platform);

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

          // TODO: project specific chart should live on the project details page.
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
                  key={`${release.projects[0]!.slug}-${release.version}`}
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

    return (
      <PageFiltersContainer showAbsolute={false}>
        <SentryDocumentTitle title={t('Releases')} orgSlug={organization.slug} />
        <NoProjectMessage organization={organization}>
          <Header />
          <Layout.Body>
            <Layout.Main fullWidth>
              {this.renderHealthCta()}

              <ReleasesPageFilterBar condensed>
                <GuideAnchor target="release_projects">
                  <ProjectPageFilter />
                </GuideAnchor>
                <EnvironmentPageFilter />
                <DatePageFilter
                  disallowArbitraryRelativeRanges
                  menuFooterMessage={t(
                    'Changing this date range will recalculate the release metrics.'
                  )}
                />
              </ReleasesPageFilterBar>

              {this.shouldShowQuickstart ? null : (
                <SortAndFilterWrapper>
                  <StyledSearchQueryBuilder
                    onSearch={this.handleSearch}
                    initialQuery={this.getQuery() || ''}
                    filterKeys={this.filterKeys}
                    getTagValues={this.getTagValues}
                    placeholder={t('Search by version, build, package, or stage')}
                    searchSource="releases"
                    showUnsubmittedIndicator
                  />
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
              <FloatingFeedbackWidget />
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

const StyledSearchQueryBuilder = styled(SearchQueryBuilder)`
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    grid-column: 1 / -1;
  }
`;

export default withApi(withProjects(withOrganization(withPageFilters(ReleasesList))));
